import { BadRequestException, ConflictException } from '@nestjs/common';
import { StockBalanceService } from './stock-balance.service';
import {
  StockMovementEngineService,
  StockDocumentContext,
} from './stock-movement-engine.service';
import type {
  StockLedgerConfig,
  StockMoveLine,
} from '../contracts/inventory-movements-core.contract';

const tables = { balance: {}, transaction: {}, costLayer: {} } as never;
const config: StockLedgerConfig = {
  ledgerScope: 'GARAGE',
  costingMethod: 'WEIGHTED_AVG',
  tables,
};
const doc: StockDocumentContext = {
  branchId: null,
  documentType: 'GARAGE_STOCK_RECEIPT',
  documentId: 'doc-1',
  transactionDate: new Date('2026-11-06'),
  createdBy: 'u1',
};

/** Giả lập số dư theo mã hàng và sổ giao dịch trong bộ nhớ. */
function setup(
  initial: Record<string, { qty: number; value: number }> = {},
  originals: unknown[] = [],
) {
  const balances: Record<string, any> = {};
  for (const [code, v] of Object.entries(initial)) {
    balances[code] = {
      ledgerScope: 'GARAGE',
      branchId: null,
      itemCode: code,
      qtyOnHand: String(v.qty),
      inventoryValue: String(v.value),
      avgCost: String(v.qty ? v.value / v.qty : 0),
    };
  }
  const txInserts: any[] = [];
  const balanceService = {
    ensureRow: jest.fn(
      async (_m: unknown, _t: unknown, key: { itemCode: string }) => {
        balances[key.itemCode] ??= {
          ledgerScope: 'GARAGE',
          branchId: null,
          itemCode: key.itemCode,
          qtyOnHand: '0',
          inventoryValue: '0',
          avgCost: '0',
        };
      },
    ),
    lockRow: jest.fn(
      async (_m: unknown, _t: unknown, key: { itemCode: string }) =>
        balances[key.itemCode],
    ),
  } as unknown as StockBalanceService;
  const txRepo = {
    insert: jest.fn(async (row: any) => {
      txInserts.push(row);
    }),
    find: jest.fn(async () => originals),
  };
  const manager = {
    getRepository: jest.fn(() => txRepo),
    save: jest.fn(async (_t: unknown, row: unknown) => row),
  } as any;
  return {
    engine: new StockMovementEngineService(balanceService),
    manager,
    balances,
    txInserts,
  };
}

describe('StockMovementEngineService.post', () => {
  it('nhập ghi tồn và sổ giao dịch RECEIPT', async () => {
    const { engine, manager, balances, txInserts } = setup();
    const lines: StockMoveLine[] = [
      {
        itemCode: 'P1',
        itemName: 'Lọc dầu',
        unit: 'Cái',
        qty: 10,
        direction: 'IN',
        transactionType: 'RECEIPT',
        unitCost: 100,
      },
    ];
    const posted = await engine.post(manager, config, doc, lines);
    expect(posted[0].appliedUnitCost).toBe(100);
    expect(Number(balances.P1.qtyOnHand)).toBe(10);
    expect(txInserts[0]).toMatchObject({
      transactionType: 'RECEIPT',
      qtyIn: '10',
      qtyOut: '0',
      documentId: 'doc-1',
    });
  });

  it('xuất dùng giá vốn bình quân và ghi ISSUE', async () => {
    const { engine, manager, balances, txInserts } = setup({
      P1: { qty: 10, value: 1000 },
    });
    const posted = await engine.post(manager, config, doc, [
      {
        itemCode: 'P1',
        itemName: 'Lọc dầu',
        unit: 'Cái',
        qty: 4,
        direction: 'OUT',
        transactionType: 'ISSUE',
      },
    ]);
    expect(posted[0].appliedUnitCost).toBe(100);
    expect(Number(balances.P1.qtyOnHand)).toBe(6);
    expect(txInserts[0]).toMatchObject({
      transactionType: 'ISSUE',
      qtyOut: '4',
      unitCost: '100',
    });
  });

  it('xuất vượt tồn bị chặn, không cắt về 0', async () => {
    const { engine, manager, balances } = setup({ P1: { qty: 3, value: 300 } });
    await expect(
      engine.post(manager, config, doc, [
        {
          itemCode: 'P1',
          itemName: 'x',
          unit: 'Cái',
          qty: 5,
          direction: 'OUT',
          transactionType: 'ISSUE',
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(Number(balances.P1.qtyOnHand)).toBe(3);
  });

  it('từ chối số lượng không dương và nhập thiếu giá', async () => {
    const { engine, manager } = setup();
    await expect(
      engine.post(manager, config, doc, [
        {
          itemCode: 'P1',
          itemName: 'x',
          unit: 'Cái',
          qty: 0,
          direction: 'IN',
          transactionType: 'RECEIPT',
          unitCost: 1,
        },
      ]),
    ).rejects.toThrow(BadRequestException);
    await expect(
      engine.post(manager, config, doc, [
        {
          itemCode: 'P1',
          itemName: 'x',
          unit: 'Cái',
          qty: 1,
          direction: 'IN',
          transactionType: 'RECEIPT',
        },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('StockMovementEngineService.reverse', () => {
  it('đảo phiếu nhập: trừ đúng số lượng và ghi RECEIPT_CANCEL', async () => {
    const originals = [
      {
        ledgerScope: 'GARAGE',
        branchId: null,
        itemCode: 'P1',
        transactionType: 'RECEIPT',
        qtyIn: '10',
        qtyOut: '0',
        unitCost: '100',
        createdAt: new Date(),
      },
    ];
    const { engine, manager, balances, txInserts } = setup(
      { P1: { qty: 10, value: 1000 } },
      originals,
    );
    await engine.reverse(manager, config, doc);
    expect(Number(balances.P1.qtyOnHand)).toBe(0);
    expect(txInserts[0]).toMatchObject({
      transactionType: 'RECEIPT_CANCEL',
      qtyOut: '10',
    });
  });

  it('không đảo phiếu nhập khi tồn đã bị xuất hết', async () => {
    const originals = [
      {
        ledgerScope: 'GARAGE',
        branchId: null,
        itemCode: 'P1',
        transactionType: 'RECEIPT',
        qtyIn: '10',
        qtyOut: '0',
        unitCost: '100',
        createdAt: new Date(),
      },
    ];
    const { engine, manager, balances } = setup(
      { P1: { qty: 4, value: 400 } },
      originals,
    );
    await expect(engine.reverse(manager, config, doc)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(Number(balances.P1.qtyOnHand)).toBe(4);
  });

  it('không đảo lần thứ hai', async () => {
    const originals = [
      {
        ledgerScope: 'GARAGE',
        branchId: null,
        itemCode: 'P1',
        transactionType: 'RECEIPT_CANCEL',
        qtyIn: '0',
        qtyOut: '10',
        unitCost: '100',
        createdAt: new Date(),
      },
    ];
    const { engine, manager } = setup({ P1: { qty: 0, value: 0 } }, originals);
    await expect(engine.reverse(manager, config, doc)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
