import type { BaseStockBalanceEntity as StockBalance } from '../entities/ledger/base-stock-balance.entity';
import type { BaseStockCostLayerEntity as StockCostLayer } from '../entities/ledger/base-stock-cost-layer.entity';

const tables = { balance: {}, transaction: {}, costLayer: {} } as never;

import { fifoStrategy } from './fifo.strategy';

function fakeManager(layers: Array<Partial<StockCostLayer>>) {
  const inserted: unknown[] = [];
  const saved: unknown[] = [];
  const repo = {
    insert: jest.fn(async (row: unknown) => {
      inserted.push(row);
    }),
    find: jest.fn(async () => layers.map((l) => ({ ...l }))),
  };
  const manager = {
    getRepository: jest.fn(() => repo),
    save: jest.fn(async (_target: unknown, row: unknown) => {
      saved.push(row);
      return row;
    }),
  };
  return { manager: manager as never, inserted, saved, repo };
}

describe('fifoStrategy', () => {
  it('nhập tạo lớp giá mới', async () => {
    const { manager, inserted } = fakeManager([]);
    const b = {
      ledgerScope: 'GARAGE',
      branchId: null,
      itemCode: 'P1',
      qtyOnHand: '0',
      inventoryValue: '0',
      avgCost: '0',
    } as unknown as StockBalance;
    await fifoStrategy.receive(
      { manager, balance: b, transactionDate: new Date(), tables },
      10,
      100,
    );
    expect(inserted).toHaveLength(1);
    expect(Number(b.qtyOnHand)).toBe(10);
    expect(Number(b.inventoryValue)).toBe(1000);
  });

  it('xuất tiêu lớp cũ nhất trước', async () => {
    const layers = [
      {
        id: 'a',
        qtyRemaining: '10',
        unitCost: '100',
        receivedAt: new Date('2026-01-01'),
      },
      {
        id: 'b',
        qtyRemaining: '10',
        unitCost: '200',
        receivedAt: new Date('2026-02-01'),
      },
    ];
    const { manager, saved } = fakeManager(layers);
    const b = {
      ledgerScope: 'GARAGE',
      branchId: null,
      itemCode: 'P1',
      qtyOnHand: '20',
      inventoryValue: '3000',
      avgCost: '150',
    } as unknown as StockBalance;
    const unit = await fifoStrategy.issue(
      { manager, balance: b, transactionDate: new Date(), tables },
      15,
    );
    // 10*100 + 5*200 = 2000 đã tiêu; còn lại 5 lớp B @200 = 1000
    expect(unit).toBe(133.33);
    expect(Number(b.qtyOnHand)).toBe(5);
    expect(Number(b.inventoryValue)).toBe(1000);
    expect(saved).toHaveLength(2);
  });

  it('ném lỗi khi lớp giá không đủ để tiêu', async () => {
    const { manager } = fakeManager([
      { id: 'a', qtyRemaining: '2', unitCost: '100', receivedAt: new Date() },
    ]);
    const b = {
      ledgerScope: 'GARAGE',
      branchId: null,
      itemCode: 'P1',
      qtyOnHand: '5',
      inventoryValue: '500',
      avgCost: '100',
    } as unknown as StockBalance;
    await expect(
      fifoStrategy.issue(
        { manager, balance: b, transactionDate: new Date(), tables },
        5,
      ),
    ).rejects.toThrow(/thiếu/);
  });
});
