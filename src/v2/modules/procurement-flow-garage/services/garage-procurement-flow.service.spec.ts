import { BadRequestException } from '@nestjs/common';
import { BaseVoucherEngineService } from '@/v2/core/goods-receipts-core/services/base-voucher-engine.service';
import { GarageGoodsReceipt } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt.entity';
import { GarageGoodsReceiptLine } from '@/v2/modules/goods-receipts-garage/entities/garage-goods-receipt-line.entity';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { GarageProcurementFlowService } from './garage-procurement-flow.service';

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
    receiptDate: '2026-11-11',
    createdBy: 'u1',
    ...over,
  });
}

function setup(
  opts: {
    receipt?: GarageGoodsReceipt;
    order?: GarageProcurementOrder | null;
    lines?: GarageGoodsReceiptLine[];
    /** Số giao dịch xuất/điều chỉnh sau phiếu trong sổ (0 = hàng chưa dùng). */
    usedAfter?: number;
  } = {},
) {
  const receipt = opts.receipt ?? makeReceipt();
  const order = opts.order === undefined ? makeOrder() : opts.order;
  const manager = {
    findOne: jest.fn(async (entity: unknown) =>
      entity === GarageProcurementOrder ? order : receipt,
    ),
    find: jest.fn().mockResolvedValue(opts.lines ?? makeLines()),
    save: jest.fn(async (_t: unknown, v: unknown) => v),
    getRepository: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      for (const m of ['select', 'where', 'andWhere']) {
        qb[m] = jest.fn(() => qb);
      }
      qb.getRawOne = jest.fn().mockResolvedValue({ at: new Date() });
      qb.getCount = jest.fn().mockResolvedValue(opts.usedAfter ?? 0);
      return { createQueryBuilder: jest.fn(() => qb) };
    }),
  };
  const dataSource = {
    transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
  };
  const publish = jest.fn().mockResolvedValue(undefined);
  const fulfilment = {
    applyGoodsReceipt: jest.fn().mockResolvedValue(undefined),
    revertGoodsReceipt: jest.fn().mockResolvedValue(undefined),
  };
  const itemResolver = {
    resolveLines: jest.fn((_m: unknown, lines: unknown) =>
      Promise.resolve(lines),
    ),
  };
  const stock = {
    post: jest.fn().mockResolvedValue(undefined),
    reverse: jest.fn().mockResolvedValue(undefined),
  };
  const svc = new GarageProcurementFlowService(
    dataSource as never,
    { publish } as never,
    fulfilment as never,
    stock as never,
    new BaseVoucherEngineService(),
    itemResolver as never,
  );
  return { svc, receipt, manager, publish, fulfilment, stock, itemResolver };
}

describe('GarageProcurementFlowService.postReceipt', () => {
  it('nhận hàng vào đơn, ghi sổ garage_stock, đổi POSTED và phát sự kiện sau commit', async () => {
    const { svc, fulfilment, stock, publish, manager } = setup();
    const out = await svc.postReceipt('r1');

    expect(out.status).toBe('POSTED');
    expect(manager.findOne).toHaveBeenCalledWith(
      GarageGoodsReceipt,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(fulfilment.applyGoodsReceipt).toHaveBeenCalledWith(manager, 'o1', [
      { orderLineId: ORDER_LINE_1, qty: 2 },
    ]);
    expect(stock.post).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        documentType: 'GOODS_RECEIPT_GARAGE',
        documentId: 'r1',
        branchId: 'b1',
        lines: [
          {
            itemCode: 'P1',
            itemName: 'Phụ tùng',
            unit: 'Cái',
            qty: 2,
            unitCost: 10,
          },
        ],
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GOODS_RECEIPT_POSTED' }),
    );
  });

  it('phiếu không gắn đơn mua: chỉ ghi sổ tồn', async () => {
    const lines = makeLines();
    lines[0].procurementOrderLineId = null;
    const { svc, fulfilment, stock } = setup({
      receipt: makeReceipt({ garageProcurementOrderId: null }),
      lines,
    });
    await svc.postReceipt('r1');
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
    expect(stock.post).toHaveBeenCalled();
  });

  it('chặn khi chi nhánh hoặc NCC khác đơn mua, không ghi sổ', async () => {
    for (const order of [
      makeOrder({ branchId: 'b2' }),
      makeOrder({ supplierId: 's9' }),
    ]) {
      const { svc, fulfilment, stock, publish } = setup({ order });
      await expect(svc.postReceipt('r1')).rejects.toThrow(BadRequestException);
      expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
      expect(stock.post).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    }
  });

  it('chặn khi dòng chưa gắn dòng đơn mua', async () => {
    const lines = makeLines();
    lines[0].procurementOrderLineId = null;
    const { svc, stock } = setup({ lines });
    await expect(svc.postReceipt('r1')).rejects.toThrow(BadRequestException);
    expect(stock.post).not.toHaveBeenCalled();
  });

  it('chặn phiếu đã POSTED và phiếu không có dòng', async () => {
    const posted = setup({ receipt: makeReceipt({ status: 'POSTED' }) });
    await expect(posted.svc.postReceipt('r1')).rejects.toThrow();
    expect(posted.stock.post).not.toHaveBeenCalled();

    const empty = setup({ lines: [] });
    await expect(empty.svc.postReceipt('r1')).rejects.toThrow(
      'chưa có mặt hàng',
    );
  });

  it('ghi sổ lỗi (tồn âm, qty 0) thì không phát sự kiện và không lưu trạng thái', async () => {
    const { svc, stock, publish, manager } = setup();
    stock.post.mockRejectedValue(new Error('qty phải > 0'));
    await expect(svc.postReceipt('r1')).rejects.toThrow('qty phải > 0');
    expect(manager.save).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('GarageProcurementFlowService.cancelReceipt', () => {
  it('phiếu đã post: hoàn đơn mua, đảo sổ tồn, đổi CANCELLED', async () => {
    const { svc, fulfilment, stock, publish } = setup({
      receipt: makeReceipt({ status: 'POSTED' }),
    });
    const out = await svc.cancelReceipt('r1');
    expect(out.status).toBe('CANCELLED');
    expect(fulfilment.revertGoodsReceipt).toHaveBeenCalled();
    expect(stock.reverse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        documentType: 'GOODS_RECEIPT_GARAGE',
        documentId: 'r1',
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GOODS_RECEIPT_CANCELLED' }),
    );
  });

  it('phiếu nháp: chỉ chuyển CANCELLED, không đụng đơn mua và sổ tồn', async () => {
    const { svc, fulfilment, stock } = setup();
    const out = await svc.cancelReceipt('r1');
    expect(out.status).toBe('CANCELLED');
    expect(fulfilment.revertGoodsReceipt).not.toHaveBeenCalled();
    expect(stock.reverse).not.toHaveBeenCalled();
  });

  it('hàng đã xuất/điều chỉnh sau phiếu: 409, không đảo sổ, không hoàn đơn mua', async () => {
    const { svc, fulfilment, stock } = setup({
      receipt: makeReceipt({ status: 'POSTED' }),
      usedAfter: 1,
    });
    await expect(svc.cancelReceipt('r1')).rejects.toThrow(
      'Hàng đã xuất/điều chỉnh sau khi nhập kho, không thể hoàn nhập',
    );
    expect(stock.reverse).not.toHaveBeenCalled();
    expect(fulfilment.revertGoodsReceipt).not.toHaveBeenCalled();
  });
});

describe('GarageProcurementFlowService.saveAndPost', () => {
  it('lưu rồi ghi sổ trong một transaction, trả phiếu POSTED', async () => {
    const { svc, stock } = setup();
    const save = jest.fn().mockResolvedValue({ id: 'r1' });
    const out = await svc.saveAndPost(save);
    expect(save).toHaveBeenCalledTimes(1);
    expect(stock.post).toHaveBeenCalled();
    expect(out.status).toBe('POSTED');
  });

  it('ghi sổ lỗi thì lỗi nổi lên (transaction rollback phiếu vừa lưu)', async () => {
    const { svc, stock } = setup();
    stock.post.mockRejectedValueOnce(new Error('lệch tồn'));
    await expect(
      svc.saveAndPost(() => Promise.resolve({ id: 'r1' })),
    ).rejects.toThrow('lệch tồn');
  });
});

describe('GarageProcurementFlowService.postReceipt - dòng thiếu mã hàng', () => {
  it('cấp mã theo danh mục trước khi ghi sổ và lưu mã vào dòng phiếu', async () => {
    const line = Object.assign(new GarageGoodsReceiptLine(), {
      id: 'rl1',
      lineNo: 1,
      itemCode: undefined,
      itemName: 'Phụ tùng',
      unit: 'Cái',
      qtyReceived: '2',
      unitCost: '10',
      procurementOrderLineId: ORDER_LINE_1,
    });
    const { svc, stock, manager, itemResolver } = setup({ lines: [line] });
    itemResolver.resolveLines.mockResolvedValueOnce([
      { itemCode: 'PT-000001' },
    ]);

    await svc.postReceipt('r1');

    expect(itemResolver.resolveLines).toHaveBeenCalledWith(manager, [line]);
    expect(manager.save).toHaveBeenCalledWith(GarageGoodsReceiptLine, [line]);
    expect(stock.post).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        lines: [expect.objectContaining({ itemCode: 'PT-000001' })],
      }),
    );
  });

  it('mọi dòng đã có mã thì không gọi danh mục', async () => {
    const { svc, itemResolver } = setup();
    await svc.postReceipt('r1');
    expect(itemResolver.resolveLines).not.toHaveBeenCalled();
  });
});
