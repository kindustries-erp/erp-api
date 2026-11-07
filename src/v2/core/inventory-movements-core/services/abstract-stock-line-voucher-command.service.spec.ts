import { BadRequestException, ConflictException } from '@nestjs/common';
import type {
  StockLedgerConfig,
  StockDirection,
  StockTransactionType,
} from '../contracts/inventory-movements-core.contract';
import { BaseStockVoucherLineEntity } from '../entities/lines/base-stock-voucher-line.entity';
import { BaseStockVoucherEntity } from '../entities/base-stock-voucher.entity';
import type { BaseCreateStockVoucherLineDto } from '../dto/base-stock-voucher-line.dto';
import { StockMovementEngineService } from './stock-movement-engine.service';
import { AbstractStockLineVoucherCommandService } from './abstract-stock-line-voucher-command.service';

/** Lớp test tối thiểu: chỉ khai báo những gì module con phải khai báo. */
class TestHeader extends BaseStockVoucherEntity {
  voucherNo = 'T-20261106-001';
  voucherDate = new Date('2026-11-06');
  branchId: string | null = null;
  totalAmount: string | null = '0';
}
class TestLine extends BaseStockVoucherLineEntity {
  voucherId = 'h1';
}

const TEST_LEDGER: StockLedgerConfig = {
  ledgerScope: 'TEST',
  costingMethod: 'WEIGHTED_AVG',
  tables: {
    balance: class {} as never,
    transaction: class {} as never,
    costLayer: class {} as never,
  },
};

class TestReceiptCommandService extends AbstractStockLineVoucherCommandService<
  TestHeader,
  TestLine
> {
  protected readonly headerEntity = TestHeader;
  protected readonly lineEntity = TestLine;
  protected readonly docType = 'TEST_DOC';
  protected readonly transactionType: StockTransactionType = 'RECEIPT';
  protected readonly ledger = TEST_LEDGER;
  protected resolveDirection(
    dto: BaseCreateStockVoucherLineDto,
  ): StockDirection {
    return ((dto as { direction?: StockDirection }).direction ??
      'IN') as StockDirection;
  }
}

const actor = { id: 'u1', roles: ['ADMIN'] };

function build(lines: Array<Record<string, unknown>>, status = 'DRAFT') {
  const engine = {
    post: jest.fn(
      async (
        _m: unknown,
        _c: unknown,
        _ctx: unknown,
        moves: Array<{ qty: number }>,
      ) => moves.map((m) => ({ ...m, appliedUnitCost: 100 })),
    ),
    reverse: jest.fn(async () => undefined),
  } as unknown as StockMovementEngineService;
  const header = {
    id: 'h1',
    voucherNo: 'T-20261106-001',
    voucherDate: new Date('2026-11-06'),
    status,
    branchId: null,
    totalAmount: '0',
  };
  const lineRepo = {
    find: jest.fn(async () => lines.map((l) => ({ ...l }))),
    save: jest.fn(async (rows: unknown) => rows),
    delete: jest.fn(async () => undefined),
    create: jest.fn((row: unknown) => row),
  };
  const manager = {
    getRepository: jest.fn(() => lineRepo),
    save: jest.fn(async (_t: unknown, row: unknown) => row),
    createQueryBuilder: jest.fn(() => ({
      setLock: () => ({
        where: () => ({ andWhere: () => ({ getOne: async () => header }) }),
      }),
    })),
    create: jest.fn((_t: unknown, row: unknown) => row),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (m: unknown) => unknown) => fn(manager)),
  };
  const events = { record: jest.fn(async () => undefined) };
  const service = new TestReceiptCommandService(
    dataSource as never,
    events as never,
    engine,
  );
  return { service, engine, header, manager };
}

describe('AbstractStockLineVoucherCommandService', () => {
  it('post gọi engine với dòng IN, loại RECEIPT, đúng sổ và mã loại chứng từ', async () => {
    const { service, engine, header, manager } = build([]);
    const lines = [
      {
        lineNo: 1,
        itemCode: 'P1',
        itemName: 'Lọc',
        unit: 'Cái',
        qty: '10',
        unitCost: '100',
        direction: 'IN',
        amount: '1000',
      },
    ];
    (manager as any).getRepository = () => ({
      find: async () => lines,
      save: async () => undefined,
    });
    await (service as any).beforeTransition(manager, header, 'post', actor);
    expect(engine.post).toHaveBeenCalledWith(
      manager,
      TEST_LEDGER,
      expect.objectContaining({ documentType: 'TEST_DOC', documentId: 'h1' }),
      [
        expect.objectContaining({
          itemCode: 'P1',
          direction: 'IN',
          transactionType: 'RECEIPT',
          unitCost: 100,
        }),
      ],
    );
  });

  it('post phiếu không có dòng thì bị chặn', async () => {
    const { service, header, manager } = build([]);
    (manager as any).getRepository = () => ({ find: async () => [] });
    await expect(
      (service as any).beforeTransition(manager, header, 'post', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hủy gọi đảo sổ, không gọi post', async () => {
    const { service, engine, header } = build([]);
    await (service as any).beforeTransition(
      {} as never,
      header,
      'cancel',
      actor,
    );
    expect(engine.reverse).toHaveBeenCalledTimes(1);
    expect(engine.post).not.toHaveBeenCalled();
  });

  it('sửa phiếu đã ghi sổ bị chặn', async () => {
    const { service } = build([], 'POSTED');
    await expect(
      service.updateDraft('h1', { lines: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('nhập thiếu giá nhập bị chặn khi tạo nháp', async () => {
    const { service } = build([]);
    await expect(
      service.createDraft(actor, {
        voucherDate: '2026-11-06',
        lines: [{ itemCode: 'P1', itemName: 'Lọc', qty: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
