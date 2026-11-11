import { DataSource, EntityManager } from 'typeorm';
import type {
  ProcurementFlowEvent,
  ProcurementFlowEventPort,
  ProcurementFlowReceiptInput,
  ProcurementFlowStockDocument,
  ProcurementOrderFulfilmentPort,
  ProcurementReceiptStockPort,
} from '../contracts/procurement-flow-core.contract';
import { AbstractProcurementFlowService } from './abstract-procurement-flow.service';

class TestFlow extends AbstractProcurementFlowService {
  constructor(
    protected readonly dataSource: DataSource,
    protected readonly events: ProcurementFlowEventPort,
    protected readonly fulfilment: ProcurementOrderFulfilmentPort,
    protected readonly stock: ProcurementReceiptStockPort,
  ) {
    super();
  }

  run<T>(
    work: (
      manager: EntityManager,
      emit: (e: ProcurementFlowEvent) => void,
    ) => Promise<T>,
  ) {
    return this.runInTransaction(work);
  }

  apply(
    manager: EntityManager,
    emit: (e: ProcurementFlowEvent) => void,
    input: ProcurementFlowReceiptInput,
  ) {
    return this.applyReceipt(manager, emit, input);
  }

  revert(
    manager: EntityManager,
    emit: (e: ProcurementFlowEvent) => void,
    input: Omit<ProcurementFlowReceiptInput, 'stock'> & {
      stock: ProcurementFlowStockDocument;
    },
  ) {
    return this.revertReceipt(manager, emit, input);
  }
}

const doc: ProcurementFlowStockDocument = {
  branchId: 'b1',
  documentType: 'GOODS_RECEIPT_GARAGE',
  documentId: 'gr-1',
  transactionDate: new Date('2026-11-11'),
  createdBy: 'u1',
};
const receipt: ProcurementFlowReceiptInput = {
  orderId: 'po-1',
  items: [{ orderLineId: 'pol-1', qty: 2 }],
  stock: {
    ...doc,
    lines: [
      { itemCode: 'OIL', itemName: 'Dầu', unit: 'Lít', qty: 2, unitCost: 75 },
    ],
  },
};

function setup() {
  const calls: string[] = [];
  const manager = {} as EntityManager;
  const publish = jest.fn().mockResolvedValue(undefined);
  const fulfilment: ProcurementOrderFulfilmentPort = {
    applyGoodsReceipt: jest.fn(async () => {
      calls.push('order.apply');
    }),
    revertGoodsReceipt: jest.fn(async () => {
      calls.push('order.revert');
    }),
  };
  const stock: ProcurementReceiptStockPort = {
    post: jest.fn(async () => {
      calls.push('stock.post');
    }),
    reverse: jest.fn(async () => {
      calls.push('stock.reverse');
    }),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
      cb(manager),
    ),
  } as unknown as DataSource;
  const flow = new TestFlow(dataSource, { publish }, fulfilment, stock);
  return { flow, manager, publish, fulfilment, stock, calls };
}

describe('AbstractProcurementFlowService.runInTransaction', () => {
  const event: ProcurementFlowEvent = {
    type: 'DONE',
    documentType: 'DOC',
    documentId: 'd1',
  };

  it('phát sự kiện sau khi commit, không phát trong lúc đang chạy', async () => {
    const { flow, publish } = setup();
    const out = await flow.run(async (_m, emit) => {
      emit(event);
      expect(publish).not.toHaveBeenCalled();
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(publish).toHaveBeenCalledWith(event);
  });

  it('rollback thì không phát sự kiện nào', async () => {
    const { flow, publish } = setup();
    await expect(
      flow.run(async (_m, emit) => {
        emit(event);
        throw new Error('lỗi bước giữa');
      }),
    ).rejects.toThrow('lỗi bước giữa');
    expect(publish).not.toHaveBeenCalled();
  });

  it('lỗi phát sự kiện chỉ ghi log, kết quả đã commit vẫn trả về', async () => {
    const { flow, publish } = setup();
    publish.mockRejectedValue(new Error('hết hạn'));
    await expect(
      flow.run(async (_m, emit) => {
        emit(event);
        return 'ok';
      }),
    ).resolves.toBe('ok');
  });
});

describe('AbstractProcurementFlowService.applyReceipt', () => {
  it('nhận hàng vào đơn mua trước rồi ghi sổ tồn, và phát sự kiện GOODS_RECEIPT_POSTED', async () => {
    const { flow, manager, calls, stock, fulfilment } = setup();
    const emitted: ProcurementFlowEvent[] = [];

    await flow.apply(manager, (e) => emitted.push(e), receipt);

    expect(calls).toEqual(['order.apply', 'stock.post']);
    expect(fulfilment.applyGoodsReceipt).toHaveBeenCalledWith(
      manager,
      'po-1',
      receipt.items,
    );
    expect(stock.post).toHaveBeenCalledWith(manager, receipt.stock);
    expect(emitted).toEqual([
      expect.objectContaining({
        type: 'GOODS_RECEIPT_POSTED',
        documentType: 'GOODS_RECEIPT_GARAGE',
        documentId: 'gr-1',
        actorId: 'u1',
        payload: { orderId: 'po-1', branchId: 'b1' },
      }),
    ]);
  });

  it('phiếu không gắn đơn mua: chỉ ghi sổ tồn, không động tới đơn mua', async () => {
    const { flow, manager, calls, fulfilment } = setup();

    await flow.apply(manager, () => undefined, {
      ...receipt,
      orderId: null,
      items: [],
    });

    expect(calls).toEqual(['stock.post']);
    expect(fulfilment.applyGoodsReceipt).not.toHaveBeenCalled();
  });

  it('đơn mua từ chối thì không ghi sổ tồn và không phát sự kiện', async () => {
    const { flow, manager, fulfilment, stock } = setup();
    (fulfilment.applyGoodsReceipt as jest.Mock).mockRejectedValue(
      new Error('vượt số đặt'),
    );
    const emitted: ProcurementFlowEvent[] = [];

    await expect(
      flow.apply(manager, (e) => emitted.push(e), receipt),
    ).rejects.toThrow('vượt số đặt');
    expect(stock.post).not.toHaveBeenCalled();
    expect(emitted).toEqual([]);
  });

  it('ghi sổ tồn lỗi thì không phát sự kiện (transaction của lớp con sẽ rollback)', async () => {
    const { flow, manager, stock } = setup();
    (stock.post as jest.Mock).mockRejectedValue(new Error('tồn âm'));
    const emitted: ProcurementFlowEvent[] = [];

    await expect(
      flow.apply(manager, (e) => emitted.push(e), receipt),
    ).rejects.toThrow('tồn âm');
    expect(emitted).toEqual([]);
  });
});

describe('AbstractProcurementFlowService.revertReceipt', () => {
  it('hoàn đơn mua rồi đảo sổ tồn, phát sự kiện GOODS_RECEIPT_CANCELLED', async () => {
    const { flow, manager, calls, stock } = setup();
    const emitted: ProcurementFlowEvent[] = [];

    await flow.revert(manager, (e) => emitted.push(e), {
      orderId: 'po-1',
      items: receipt.items,
      stock: doc,
    });

    expect(calls).toEqual(['order.revert', 'stock.reverse']);
    expect(stock.reverse).toHaveBeenCalledWith(manager, doc);
    expect(emitted[0]).toEqual(
      expect.objectContaining({ type: 'GOODS_RECEIPT_CANCELLED' }),
    );
  });

  it('phiếu không gắn đơn mua: chỉ đảo sổ tồn', async () => {
    const { flow, manager, calls, fulfilment } = setup();

    await flow.revert(manager, () => undefined, {
      orderId: null,
      items: [],
      stock: doc,
    });

    expect(calls).toEqual(['stock.reverse']);
    expect(fulfilment.revertGoodsReceipt).not.toHaveBeenCalled();
  });
});
