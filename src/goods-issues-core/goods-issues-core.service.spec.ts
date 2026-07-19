import { DataSource } from 'typeorm';
import { GoodsIssuesCoreService } from './goods-issues-core.service';
import { ErpGoodsIssue } from './entities/erp_goods_issue.entity';
import { ErpGoodsIssueLine } from './entities/erp_goods_issue_line.entity';
import { ErpInventoryTransaction } from '../inventory-core/entities/erp_inventory_transaction.entity';
import { ErpInventoryBalance } from '../inventory-core/entities/erp_inventory_balance.entity';
import { ErpSalesOrder } from '../sales-orders-core/entities/erp_sales_order.entity';
import { ErpSalesOrderLine } from '../sales-orders-core/entities/erp_sales_order_line.entity';
import { ErpInventoryTrackingSerial } from '../inventory-core/entities/erp_inventory_tracking_serial.entity';
import { ErpInventoryItem } from '../inventory-core/entities/erp_inventory_item.entity';
import { ErpVehicle } from '../erp-mfg-core/entities/erp_vehicle.entity';
import { ErpProductionOrder } from '../production-core/entities/erp_production_order.entity';
import { ErpProductionOrderMaterial } from '../production-core/entities/erp_production_order_material.entity';

describe('GoodsIssuesCoreService stock and reserve invariants', () => {
  function makeManager(repoMap: Map<any, any>) {
    return {
      getRepository: (entity: any) => repoMap.get(entity),
    };
  }

  function makeServiceWithManager(manager: any) {
    const dataSource = {
      transaction: jest.fn(async (cb: any) => cb(manager)),
    } as unknown as DataSource;

    const service = new GoodsIssuesCoreService(
      dataSource,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service, 'findOne').mockResolvedValue({ ok: true } as any);
    return { service };
  }

  it('postIssue should decrease onHand and consume reserved qty from SO reservation path', async () => {
    const issue = {
      id: 'gi1',
      issueNo: 'GI-001',
      issueDate: new Date('2026-07-01'),
      status: 'DRAFT',
      salesOrderId: 'so1',
      remarks: null,
      createdBy: 'u1',
    } as any;
    const line = {
      id: 'gil1',
      lineNo: 1,
      goodsIssueId: 'gi1',
      itemId: 'item1',
      qtyIssued: '3.000',
      unitCost: '2.000',
      salesOrderLineId: 'sol1',
      productionOrderMaterialId: null,
      serialId: null,
      vehicleId: null,
    } as any;
    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '4.000',
      inventoryValue: '20.000',
      avgUnitCost: '2.000',
    } as any;
    const soLine = {
      id: 'sol1',
      salesOrderId: 'so1',
      qtyOrdered: '5.000',
      qtyReserved: '2.000',
      qtyDelivered: '0.000',
    } as any;
    const so = { id: 'so1', status: 'CONFIRMED' } as any;

    const issueRepo = {
      findOneBy: jest.fn().mockResolvedValue(issue),
      save: jest.fn(async (x: any) => x),
    };
    const lineRepo = {
      find: jest.fn().mockResolvedValue([line]),
    };
    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (x: any) => x),
    };
    const soRepo = {
      findOneBy: jest.fn().mockResolvedValue(so),
      save: jest.fn(async (x: any) => x),
    };
    const soLineRepo = {
      findOneBy: jest.fn().mockResolvedValue(soLine),
      save: jest.fn(async (x: any) => x),
      find: jest.fn().mockResolvedValue([soLine]),
    };
    const moRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const moMatRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const serialRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const vehicleRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const itemRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'item1', itemType: { code: 'FG' } }),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
      [ErpInventoryTrackingSerial, serialRepo],
      [ErpVehicle, vehicleRepo],
      [ErpInventoryItem, itemRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.postIssue('gi1', { warehouseCode: 'WH1' });

    expect(balance.qtyOnHand).toBe('7.000');
    expect(balance.qtyReserved).toBe('2.000');
    expect(soLine.qtyReserved).toBe('0.000');
    expect(soLine.qtyDelivered).toBe('3.000');
    expect(issue.status).toBe('POSTED');
    expect(txnRepo.save).toHaveBeenCalled();

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(5);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
  });

  it('cancelIssue should restore onHand and reserved qty, and revert delivered qty on SO line', async () => {
    const issue = {
      id: 'gi1',
      issueNo: 'GI-001',
      issueDate: new Date('2026-07-01'),
      status: 'POSTED',
      salesOrderId: 'so1',
    } as any;
    const line = {
      id: 'gil1',
      lineNo: 1,
      goodsIssueId: 'gi1',
      itemId: 'item1',
      qtyIssued: '3.000',
      unitCost: '2.000',
      salesOrderLineId: 'sol1',
      productionOrderMaterialId: null,
      serialId: null,
      vehicleId: null,
    } as any;
    const balance = {
      itemId: 'item1',
      qtyOnHand: '7.000',
      qtyReserved: '2.000',
      inventoryValue: '14.000',
      avgUnitCost: '2.000',
    } as any;
    const soLine = {
      id: 'sol1',
      salesOrderId: 'so1',
      qtyOrdered: '5.000',
      qtyDelivered: '3.000',
      qtyReserved: '0.000',
    } as any;
    const so = { id: 'so1', status: 'PARTIAL_DELIVERING' } as any;

    const issueRepo = {
      findOneBy: jest.fn().mockResolvedValue(issue),
      save: jest.fn(async (x: any) => x),
    };
    const lineRepo = {
      find: jest.fn().mockResolvedValue([line]),
    };
    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (x: any) => x),
    };
    const soRepo = {
      findOneBy: jest.fn().mockResolvedValue(so),
      save: jest.fn(async (x: any) => x),
    };
    const soLineRepo = {
      findOneBy: jest.fn().mockResolvedValue(soLine),
      save: jest.fn(async (x: any) => x),
      find: jest
        .fn()
        .mockResolvedValue([
          { ...soLine, qtyDelivered: '0.000', qtyOrdered: '5.000' },
        ]),
    };
    const moRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const moMatRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const serialRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const vehicleRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const itemRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'item1', itemType: { code: 'FG' } }),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
      [ErpInventoryTrackingSerial, serialRepo],
      [ErpVehicle, vehicleRepo],
      [ErpInventoryItem, itemRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.cancelIssue('gi1');

    expect(balance.qtyOnHand).toBe('10.000');
    expect(balance.qtyReserved).toBe('5.000');
    expect(soLine.qtyDelivered).toBe('0.000');
    expect(issue.status).toBe('CANCELLED');

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(5);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
  });

  it('postIssue should not consume reserved when line has no SO/MO reference (balance path)', async () => {
    const issue = {
      id: 'gi2',
      issueNo: 'GI-002',
      issueDate: new Date('2026-07-02'),
      status: 'DRAFT',
      salesOrderId: null,
      remarks: null,
      createdBy: 'u1',
    } as any;
    const line = {
      id: 'gil2',
      lineNo: 1,
      goodsIssueId: 'gi2',
      itemId: 'item1',
      qtyIssued: '3.000',
      unitCost: '2.000',
      salesOrderLineId: null,
      productionOrderMaterialId: null,
      serialId: null,
      vehicleId: null,
    } as any;
    const balance = {
      itemId: 'item1',
      warehouseCode: 'WH1',
      qtyOnHand: '10.000',
      qtyReserved: '4.000',
      inventoryValue: '20.000',
      avgUnitCost: '2.000',
    } as any;

    const issueRepo = {
      findOneBy: jest.fn().mockResolvedValue(issue),
      save: jest.fn(async (x: any) => x),
    };
    const lineRepo = {
      find: jest.fn().mockResolvedValue([line]),
    };
    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (x: any) => x),
    };
    const soRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
    };
    const soLineRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const moRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const moMatRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const serialRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const vehicleRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const itemRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'item1', itemType: { code: 'FG' } }),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
      [ErpInventoryTrackingSerial, serialRepo],
      [ErpVehicle, vehicleRepo],
      [ErpInventoryItem, itemRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.postIssue('gi2', { warehouseCode: 'WH1' });

    expect(balance.qtyOnHand).toBe('7.000');
    expect(balance.qtyReserved).toBe('4.000');
    expect(issue.status).toBe('POSTED');

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(availableQty).toBe(3);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
  });

  it('cancelIssue should revert serial and vehicle status to AVAILABLE and clear serial link', async () => {
    const issue = {
      id: 'gi3',
      issueNo: 'GI-003',
      issueDate: new Date('2026-07-03'),
      status: 'POSTED',
      salesOrderId: 'so1',
    } as any;
    const line = {
      id: 'gil3',
      lineNo: 1,
      goodsIssueId: 'gi3',
      itemId: 'item1',
      qtyIssued: '1.000',
      unitCost: '2.000',
      salesOrderLineId: 'sol1',
      productionOrderMaterialId: null,
      serialId: 'ser1',
      vehicleId: 'veh1',
    } as any;
    const balance = {
      itemId: 'item1',
      qtyOnHand: '9.000',
      qtyReserved: '1.000',
      inventoryValue: '18.000',
      avgUnitCost: '2.000',
    } as any;
    const soLine = {
      id: 'sol1',
      salesOrderId: 'so1',
      qtyOrdered: '1.000',
      qtyDelivered: '1.000',
      qtyReserved: '0.000',
    } as any;
    const so = { id: 'so1', status: 'DELIVERING' } as any;
    const serial = {
      id: 'ser1',
      status: 'DELIVERING',
      goodsIssueLineId: 'gil3',
    } as any;
    const vehicle = {
      id: 'veh1',
      status: 'DELIVERING',
    } as any;

    const issueRepo = {
      findOneBy: jest.fn().mockResolvedValue(issue),
      save: jest.fn(async (x: any) => x),
    };
    const lineRepo = {
      find: jest.fn().mockResolvedValue([line]),
    };
    const txnRepo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
    };
    const balanceRepo = {
      findOne: jest.fn().mockResolvedValue(balance),
      save: jest.fn(async (x: any) => x),
    };
    const soRepo = {
      findOneBy: jest.fn().mockResolvedValue(so),
      save: jest.fn(async (x: any) => x),
    };
    const soLineRepo = {
      findOneBy: jest.fn().mockResolvedValue(soLine),
      save: jest.fn(async (x: any) => x),
      find: jest
        .fn()
        .mockResolvedValue([
          { ...soLine, qtyDelivered: '0.000', qtyOrdered: '1.000' },
        ]),
    };
    const moRepo = { findOneBy: jest.fn(), save: jest.fn() };
    const moMatRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const serialRepo = {
      findOneBy: jest.fn().mockResolvedValue(serial),
      save: jest.fn(async (x: any) => x),
    };
    const vehicleRepo = {
      findOneBy: jest.fn().mockResolvedValue(vehicle),
      save: jest.fn(async (x: any) => x),
    };
    const itemRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'item1', itemType: { code: 'FG' } }),
    };

    const repoMap = new Map<any, any>([
      [ErpGoodsIssue, issueRepo],
      [ErpGoodsIssueLine, lineRepo],
      [ErpInventoryTransaction, txnRepo],
      [ErpInventoryBalance, balanceRepo],
      [ErpSalesOrder, soRepo],
      [ErpSalesOrderLine, soLineRepo],
      [ErpProductionOrder, moRepo],
      [ErpProductionOrderMaterial, moMatRepo],
      [ErpInventoryTrackingSerial, serialRepo],
      [ErpVehicle, vehicleRepo],
      [ErpInventoryItem, itemRepo],
    ]);

    const manager = makeManager(repoMap);
    const { service } = makeServiceWithManager(manager);

    await service.cancelIssue('gi3');

    expect(serial.status).toBe('AVAILABLE');
    expect(serial.goodsIssueLineId).toBeNull();
    expect(vehicle.status).toBe('AVAILABLE');
    expect(serialRepo.save).toHaveBeenCalled();
    expect(vehicleRepo.save).toHaveBeenCalled();
    expect(issue.status).toBe('CANCELLED');

    const availableQty =
      Number(balance.qtyOnHand) - Number(balance.qtyReserved);
    expect(Number(balance.qtyReserved)).toBeGreaterThanOrEqual(0);
    expect(availableQty).toBe(8);
  });
});
