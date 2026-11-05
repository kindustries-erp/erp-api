import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { GarageProcurementOrder } from '@/v2/modules/garage-procurement-orders/entities/procurement-order.entity';
import { GarageGoodsReceiptCommandService } from './garage-goods-receipt-command.service';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts/services/base-voucher-engine.service';

const ORDER_LINE_1 = '11111111-1111-4111-8111-111111111111';

function makeOrder(over: Partial<GarageProcurementOrder> = {}) {
  return Object.assign(new GarageProcurementOrder(), {
    id: 'o1',
    branchId: 'b1',
    supplierId: 's1',
    isDeleted: false,
    ...over,
  });
}

function makeReceipt(over: Partial<GarageGoodsReceipt> = {}) {
  return Object.assign(new GarageGoodsReceipt(), {
    id: 'r1',
    status: 'DRAFT',
    branchId: 'b1',
    supplierId: 's1',
    garageProcurementOrderId: 'o1',
    lines: [
      Object.assign(new GarageGoodsReceiptLine(), {
        id: 'rl1',
        lineNo: 1,
        itemCode: 'P1',
        itemName: 'Phụ tùng',
        qtyReceived: '2',
        unitCost: '10',
        procurementOrderLineId: ORDER_LINE_1,
      }),
    ],
    ...over,
  });
}

function setup(order: GarageProcurementOrder | null) {
  const repos = {
    GarageGoodsReceipt: { save: jest.fn(async (v: unknown) => v) },
    GarageGoodsReceiptLine: {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (v: unknown) => v),
    },
    GarageInventoryBalance: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v: object) => v),
      save: jest.fn(async (v: unknown) => v),
    },
  };
  const manager = {
    findOne: jest.fn(async (entity: unknown) =>
      entity === GarageProcurementOrder ? order : null,
    ),
    getRepository: jest.fn(
      (cls: { name: keyof typeof repos }) => repos[cls.name],
    ),
  };
  const dataSource = {
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  };
  const fulfilment = {
    applyGoodsReceipt: jest.fn().mockResolvedValue(undefined),
    revertGoodsReceipt: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new GarageGoodsReceiptCommandService(
    dataSource as never,
    {} as never,
    new BaseVoucherEngineService(),
    fulfilment as never,
  );
  return { svc, fulfilment, repos };
}

describe('GarageGoodsReceiptCommandService - liên kết đơn mua garage', () => {
  it('post phiếu gắn đơn mua thì ghi nhận nhận hàng vào đơn trong cùng transaction', async () => {
    const { svc, fulfilment } = setup(makeOrder());
    const posted = await svc.post(makeReceipt());
    expect(posted.status).toBe('POSTED');
    expect(fulfilment.applyGoodsReceipt).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      [{ orderLineId: ORDER_LINE_1, qty: 2 }],
    );
  });

  it('post từ chối khi chi nhánh phiếu khác đơn mua, không ghi nhận nhận hàng', async () => {
    const { svc, fulfilment } = setup(makeOrder({ branchId: 'b2' }));
    await expect(svc.post(makeReceipt())).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('post từ chối khi NCC phiếu khác đơn mua', async () => {
    const { svc, fulfilment } = setup(makeOrder({ supplierId: 's9' }));
    await expect(svc.post(makeReceipt())).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('post từ chối khi một dòng chưa gắn dòng đơn mua', async () => {
    const { svc, fulfilment } = setup(makeOrder());
    const receipt = makeReceipt();
    receipt.lines![0].procurementOrderLineId = null;
    await expect(svc.post(receipt)).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('cancel phiếu đã post gắn đơn mua thì hoàn số đã nhận trên đơn', async () => {
    const { svc, fulfilment } = setup(makeOrder());
    const receipt = makeReceipt({ status: 'POSTED' });
    await svc.cancel(receipt);
    expect(fulfilment.revertGoodsReceipt).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      [{ orderLineId: ORDER_LINE_1, qty: 2 }],
    );
    expect(receipt.status).toBe('CANCELLED');
  });

  it('post phiếu không gắn đơn mua thì không đụng tới đơn', async () => {
    const { svc, fulfilment } = setup(makeOrder());
    await svc.post(makeReceipt({ garageProcurementOrderId: null }));
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('chi nhánh null tra tồn bằng IS NULL, không bỏ qua điều kiện', async () => {
    const { svc, repos } = setup(null);
    await svc.post(
      makeReceipt({ branchId: null, garageProcurementOrderId: null }),
    );
    const where = repos.GarageInventoryBalance.findOne.mock.calls[0][0].where;
    expect(where.branchId).toBeInstanceOf(FindOperator);
  });
});
