import type { BaseStockBalanceEntity as StockBalance } from '../entities/ledger/base-stock-balance.entity';
import { weightedAvgStrategy } from './weighted-avg.strategy';

function balanceOf(qty: string, value: string, avg = '0'): StockBalance {
  return {
    qtyOnHand: qty,
    inventoryValue: value,
    avgCost: avg,
    itemCode: 'P1',
  } as unknown as StockBalance;
}
const tables = { balance: {}, transaction: {}, costLayer: {} } as never;
const ctx = (balance: StockBalance) => ({
  manager: {} as never,
  balance,
  transactionDate: new Date(),
  tables,
});

describe('weightedAvgStrategy', () => {
  it('nhập rồi xuất theo bình quân gia quyền', async () => {
    const b = balanceOf('0', '0');
    await weightedAvgStrategy.receive(ctx(b), 10, 100);
    await weightedAvgStrategy.receive(ctx(b), 10, 200);
    expect(Number(b.qtyOnHand)).toBe(20);
    expect(Number(b.inventoryValue)).toBe(3000);
    expect(Number(b.avgCost)).toBe(150);

    const unit = await weightedAvgStrategy.issue(ctx(b), 5);
    expect(unit).toBe(150);
    expect(Number(b.qtyOnHand)).toBe(15);
    expect(Number(b.inventoryValue)).toBe(2250);
  });

  it('xuất hết thì giá trị về 0, không còn số âm', async () => {
    const b = balanceOf('4', '400', '100');
    await weightedAvgStrategy.issue(ctx(b), 4);
    expect(Number(b.qtyOnHand)).toBe(0);
    expect(Number(b.inventoryValue)).toBe(0);
  });

  it('hoàn nhập bỏ đúng giá đã nhập', async () => {
    const b = balanceOf('20', '3000', '150');
    const unit = await weightedAvgStrategy.withdrawReceived(ctx(b), 10, 200);
    expect(unit).toBe(200);
    expect(Number(b.qtyOnHand)).toBe(10);
    expect(Number(b.inventoryValue)).toBe(1000);
  });
});
