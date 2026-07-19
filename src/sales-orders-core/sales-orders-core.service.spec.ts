import { DataSource } from 'typeorm';
import { SalesOrdersCoreService } from './sales-orders-core.service';
import { ErpSalesOrder } from './entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from './entities/erp_sales_order_line.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';

describe('SalesOrdersCoreService reserve/unreserve', () => {
  function makeManager(repoMap: Map<any, any>) {
    return {
      getRepository: (entity: any) => repoMap.get(entity),
    };
  }

  function makeServiceWithManager(manager: any) {
    const dataSource = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new SalesOrdersCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service, 'findOne').mockResolvedValue({ ok: true } as any);
    return { service, dataSource };
  }

  it('reserve should increase qtyReserved on SO line and inventory balance, then set SO status RESERVED', async () => {
    const so = { id: 'so1', status: 'CONFIRMED', isDeleted: false } as any;
    const soLine = {
      id: 'line1',
      lineNo: 1,
      salesOrderId: 'so1',
      itemId: 'item1',
      qtyOrdered: '5.000',
      qtyDelivered: '0.000',
      qtyReserved: '0.000',
      selectedSerialIds: null,
    } as any;
    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '1.000',
    } as any;

    const soRepo = {
      findOne: jest.fn().mockResolvedValue(so),
      save: jest.fn().mockResolvedValue(so),
    };
    const soLineRepo = {
      find: jest.fn().mockResolvedValue([soLine]),
      save: jest.fn(async (line: any) => line),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (b: any) => b),
    };
    const itemRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const serialRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const repoMap = new Map<any, any>([
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpInventoryItem, itemRepo],
      [ErpInventoryTrackingSerial, serialRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.reserve('so1', { warehouseCode: 'WH1' });

    expect(balance.qtyReserved).toBe('6.000');
    expect(soLine.qtyReserved).toBe('5.000');
    expect(so.status).toBe('RESERVED');
    expect(balanceRepo.save).toHaveBeenCalled();
    expect(soLineRepo.save).toHaveBeenCalled();
    expect(soRepo.save).toHaveBeenCalled();

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(4);
  });

  it('unreserve should release reserved qty from line and balance, and return SO to CONFIRMED when nothing delivered', async () => {
    const so = {
      id: 'so1',
      status: 'PARTIAL_RESERVED',
      isDeleted: false,
    } as any;
    const soLine = {
      id: 'line1',
      lineNo: 1,
      salesOrderId: 'so1',
      itemId: 'item1',
      qtyOrdered: '5.000',
      qtyDelivered: '0.000',
      qtyReserved: '3.000',
    } as any;
    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '4.000',
    } as any;

    const soRepo = {
      findOne: jest.fn().mockResolvedValue(so),
      save: jest.fn().mockResolvedValue(so),
    };
    const soLineRepo = {
      find: jest.fn().mockResolvedValue([soLine]),
      save: jest.fn(async (line: any) => line),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (b: any) => b),
    };
    const serialRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const repoMap = new Map<any, any>([
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpInventoryTrackingSerial, serialRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.unreserve('so1', { warehouseCode: 'WH1' });

    expect(balance.qtyReserved).toBe('1.000');
    expect(soLine.qtyReserved).toBe('0.000');
    expect(so.status).toBe('CONFIRMED');
    expect(serialRepo.update).toHaveBeenCalled();

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(9);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
  });

  it('reserve should be partial when tracking serials available are fewer than qty needed', async () => {
    const so = { id: 'so1', status: 'CONFIRMED', isDeleted: false } as any;
    const soLine = {
      id: 'line1',
      lineNo: 1,
      salesOrderId: 'so1',
      itemId: 'item1',
      qtyOrdered: '5.000',
      qtyDelivered: '0.000',
      qtyReserved: '0.000',
      selectedSerialIds: ['s1', 's2', 's3'],
    } as any;
    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '0.000',
    } as any;

    const soRepo = {
      findOne: jest.fn().mockResolvedValue(so),
      save: jest.fn().mockResolvedValue(so),
    };
    const soLineRepo = {
      find: jest.fn().mockResolvedValue([soLine]),
      save: jest.fn(async (line: any) => line),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (b: any) => b),
    };
    const itemRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'item1',
        trackingPolicyId: 'SERIAL',
      }),
    };
    const serialRepo = {
      find: jest.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const repoMap = new Map<any, any>([
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpInventoryItem, itemRepo],
      [ErpInventoryTrackingSerial, serialRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.reserve('so1', { warehouseCode: 'WH1' });

    expect(serialRepo.update).toHaveBeenCalledWith(
      { id: expect.anything() },
      { status: 'RESERVED', salesOrderLineId: 'line1' },
    );
    expect(soLine.qtyReserved).toBe('2.000');
    expect(balance.qtyReserved).toBe('2.000');
    expect(so.status).toBe('PARTIAL_RESERVED');

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(8);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
  });

  it('reserve should only reserve IN_STOCK serials from selectedSerialIds (mixed statuses)', async () => {
    const so = { id: 'so2', status: 'CONFIRMED', isDeleted: false } as any;
    const soLine = {
      id: 'line2',
      lineNo: 1,
      salesOrderId: 'so2',
      itemId: 'item2',
      qtyOrdered: '3.000',
      qtyDelivered: '0.000',
      qtyReserved: '0.000',
      selectedSerialIds: ['s-available', 's-reserved', 's-sold'],
    } as any;
    const balance = {
      itemId: 'item2',
      warehouseCode: 'WH1',
      qtyOnHand: '5.000',
      qtyReserved: '1.000',
    } as any;

    const soRepo = {
      findOne: jest.fn().mockResolvedValue(so),
      save: jest.fn().mockResolvedValue(so),
    };
    const soLineRepo = {
      find: jest.fn().mockResolvedValue([soLine]),
      save: jest.fn(async (line: any) => line),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (b: any) => b),
    };
    const itemRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'item2',
        trackingPolicyId: 'SERIAL',
      }),
    };
    const serialRepo = {
      // Simulate mixed selected IDs where only one is IN_STOCK.
      find: jest.fn().mockResolvedValue([{ id: 's-available' }]),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const repoMap = new Map<any, any>([
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpInventoryItem, itemRepo],
      [ErpInventoryTrackingSerial, serialRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.reserve('so2', { warehouseCode: 'WH1' });

    expect(serialRepo.find).toHaveBeenCalledWith({
      where: { id: expect.anything(), status: 'IN_STOCK' },
    });
    expect(serialRepo.update).toHaveBeenCalledTimes(1);
    expect(soLine.qtyReserved).toBe('1.000');
    expect(balance.qtyReserved).toBe('2.000');
    expect(so.status).toBe('PARTIAL_RESERVED');

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(3);
  });
});
