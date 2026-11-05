import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { GarageGoodsReceipt } from '../entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '../entities/garage-goods-receipt-line.entity';
import { GarageInventoryBalance } from '../entities/garage-inventory-balance.entity';
import { GarageProcurementOrder } from '@/v2/modules/garage-procurement-orders/entities/procurement-order.entity';
import { GarageGoodsReceiptCommandService } from './garage-goods-receipt-command.service';
import { GarageInventoryBalanceService } from './garage-inventory-balance.service';
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

function makeLines(): GarageGoodsReceiptLine[] {
  return [
    Object.assign(new GarageGoodsReceiptLine(), {
      id: 'rl1',
      lineNo: 1,
      itemCode: 'P1',
      itemName: 'Phụ tùng',
      unit: 'Cái',
      qtyReceived: '2',
      unitCost: '10',
      procurementOrderLineId: ORDER_LINE_1,
    }),
  ];
}

function makeReceipt(over: Partial<GarageGoodsReceipt> = {}) {
  return Object.assign(new GarageGoodsReceipt(), {
    id: 'r1',
    status: 'DRAFT',
    branchId: 'b1',
    supplierId: 's1',
    garageProcurementOrderId: 'o1',
    lines: makeLines(),
    ...over,
  });
}

interface SetupOptions {
  order?: GarageProcurementOrder | null;
  /** Bản ghi phiếu trả về khi khóa; mặc định là một bản sao của receipt được truyền vào. */
  locked?: GarageGoodsReceipt;
  lines?: GarageGoodsReceiptLine[];
}

function setup(opts: SetupOptions = {}) {
  const order = opts.order === undefined ? makeOrder() : opts.order;
  const lines = opts.lines ?? makeLines();
  const repos = {
    GarageGoodsReceipt: { save: jest.fn(async (v: unknown) => v) },
    GarageGoodsReceiptLine: {
      find: jest.fn().mockResolvedValue(lines),
      save: jest.fn(async (v: unknown) => v),
    },
  };
  const manager = {
    findOne: jest.fn(async (entity: unknown) => {
      if (entity === GarageProcurementOrder) return order;
      if (entity === GarageGoodsReceipt) return opts.locked ?? null;
      if (entity === GarageInventoryBalance) {
        return Object.assign(new GarageInventoryBalance(), {
          qtyOnHand: '0',
          avgCost: '0',
        });
      }
      return null;
    }),
    query: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(async (_target: unknown, v: unknown) => v),
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
    new GarageInventoryBalanceService(),
  );
  return { svc, fulfilment, manager };
}

describe('GarageGoodsReceiptCommandService - liên kết đơn mua garage', () => {
  it('post phiếu gắn đơn mua thì ghi nhận nhận hàng vào đơn trong cùng transaction', async () => {
    const receipt = makeReceipt();
    const { svc, fulfilment } = setup({ locked: receipt });
    const posted = await svc.post(receipt);
    expect(posted.status).toBe('POSTED');
    expect(fulfilment.applyGoodsReceipt).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      [{ orderLineId: ORDER_LINE_1, qty: 2 }],
    );
  });

  it('post từ chối khi chi nhánh phiếu khác đơn mua, không ghi nhận nhận hàng', async () => {
    const receipt = makeReceipt();
    const { svc, fulfilment } = setup({
      order: makeOrder({ branchId: 'b2' }),
      locked: receipt,
    });
    await expect(svc.post(receipt)).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('post từ chối khi NCC phiếu khác đơn mua', async () => {
    const receipt = makeReceipt();
    const { svc, fulfilment } = setup({
      order: makeOrder({ supplierId: 's9' }),
      locked: receipt,
    });
    await expect(svc.post(receipt)).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('post từ chối khi một dòng chưa gắn dòng đơn mua', async () => {
    const lines = makeLines();
    lines[0].procurementOrderLineId = null;
    const receipt = makeReceipt({ lines });
    const { svc, fulfilment } = setup({ locked: receipt, lines });
    await expect(svc.post(receipt)).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('cancel phiếu đã post gắn đơn mua thì hoàn số đã nhận trên đơn', async () => {
    const receipt = makeReceipt({ status: 'POSTED' });
    const { svc, fulfilment } = setup({ locked: receipt });
    const cancelled = await svc.cancel(receipt);
    expect(fulfilment.revertGoodsReceipt).toHaveBeenCalledWith(
      expect.anything(),
      'o1',
      [{ orderLineId: ORDER_LINE_1, qty: 2 }],
    );
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('post phiếu không gắn đơn mua thì không đụng tới đơn', async () => {
    const receipt = makeReceipt({ garageProcurementOrderId: null });
    const { svc, fulfilment } = setup({ locked: receipt });
    await svc.post(receipt);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });
});

describe('GarageGoodsReceiptCommandService - khóa phiếu và tồn', () => {
  it('post khóa phiếu bằng pessimistic_write trước khi kiểm trạng thái', async () => {
    const receipt = makeReceipt();
    const { svc, manager } = setup({ locked: receipt });
    await svc.post(receipt);
    expect(manager.findOne).toHaveBeenCalledWith(
      GarageGoodsReceipt,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('post lần hai trên phiếu đã POSTED bị chặn và không nhận hàng lần nữa', async () => {
    const receipt = makeReceipt({ status: 'POSTED' });
    const { svc, fulfilment } = setup({ locked: receipt });
    await expect(svc.post(receipt)).rejects.toThrow(BadRequestException);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('tồn chi nhánh null: tạo dòng với conflict theo chỉ mục IS NULL và khóa bằng IS NULL', async () => {
    const receipt = makeReceipt({
      branchId: null,
      garageProcurementOrderId: null,
    });
    const { svc, manager } = setup({ locked: receipt });
    await svc.post(receipt);

    const insertSql = manager.query.mock.calls[0][0] as string;
    expect(insertSql).toContain(
      'ON CONFLICT ("item_code") WHERE "branch_id" IS NULL',
    );

    const lockOptions = manager.findOne.mock.calls
      .map((call) => call as unknown[])
      .find(([entity]) => entity === GarageInventoryBalance)?.[1] as
      | { where: { branchId: unknown }; lock: unknown }
      | undefined;
    expect(lockOptions?.where.branchId).toBeInstanceOf(FindOperator);
    expect(lockOptions?.lock).toEqual({ mode: 'pessimistic_write' });
  });

  it('tồn chi nhánh có giá trị: conflict theo chỉ mục có chi nhánh', async () => {
    const receipt = makeReceipt({ garageProcurementOrderId: null });
    const { svc, manager } = setup({ locked: receipt });
    await svc.post(receipt);
    const insertSql = manager.query.mock.calls[0][0] as string;
    expect(insertSql).toContain(
      'ON CONFLICT ("branch_id", "item_code") WHERE "branch_id" IS NOT NULL',
    );
  });
});
