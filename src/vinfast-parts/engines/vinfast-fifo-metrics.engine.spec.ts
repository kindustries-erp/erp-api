import {
  calculateLedgerHistoryCogs,
  LedgerEntryForFifo,
} from './vinfast-fifo.engine';

const IN_2_AT_100: LedgerEntryForFifo = {
  id: 'in-1',
  direction: 'IN',
  qty: 2,
  unitCost: 100,
  preVatAmount: 200,
  transactionDate: '2026-01-01',
};

describe('vinfast-fifo engine: lũy kế tồn và số liệu thiếu hàng', () => {
  it('should report running balance and value for a normal sale', () => {
    const result = calculateLedgerHistoryCogs([
      IN_2_AT_100,
      {
        id: 'out-1',
        direction: 'OUT',
        qty: 1,
        preVatAmount: 150,
        transactionDate: '2026-01-05',
      },
    ]);

    expect(result[1].calculatedCogs).toBe(100);
    expect(result[1].balanceQty).toBe(1);
    expect(result[1].balanceValue).toBe(100);
    expect(result[1].shortageQty).toBe(0);
  });

  it('should keep a negative balance and report shortage when a sale exceeds stock', () => {
    const result = calculateLedgerHistoryCogs([
      { ...IN_2_AT_100, qty: 1, preVatAmount: 100 },
      {
        id: 'out-1',
        direction: 'OUT',
        qty: 3,
        preVatAmount: 450,
        transactionDate: '2026-01-05',
      },
    ]);

    expect(result[1].calculatedCogs).toBe(100);
    expect(result[1].shortageQty).toBe(2);
    expect(result[1].balanceQty).toBe(-2);
    expect(result[1].balanceValue).toBe(0);
  });

  it('should return units to stock at original cost and give a negative COGS', () => {
    const result = calculateLedgerHistoryCogs([
      IN_2_AT_100,
      {
        id: 'out-1',
        direction: 'OUT',
        qty: 2,
        preVatAmount: 300,
        transactionDate: '2026-01-05',
      },
      {
        id: 'ret-1',
        direction: 'OUT',
        qty: 1,
        adjSign: -1,
        isAdjustment: true,
        preVatAmount: 150,
        transactionDate: '2026-01-07',
      },
    ]);

    expect(result[2].calculatedCogs).toBe(-100);
    expect(result[2].balanceQty).toBe(1);
    expect(result[2].balanceValue).toBe(100);
  });

  it('should match the stock formula sum(IN signed) - sum(OUT signed) on 200 seeded random sequences', () => {
    let seed = 20260101;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let run = 0; run < 200; run++) {
      const entries: LedgerEntryForFifo[] = [];
      let expectedBalance = 0;
      const steps = 3 + Math.floor(rand() * 12);

      for (let s = 0; s < steps; s++) {
        const q = 1 + Math.floor(rand() * 5);
        const roll = rand();
        const id = `r${run}-${s}`;
        const date = `2026-02-${String(s + 1).padStart(2, '0')}`;

        if (roll < 0.4) {
          entries.push({
            id,
            direction: 'IN',
            qty: q,
            unitCost: 100,
            preVatAmount: q * 100,
            transactionDate: date,
          });
          expectedBalance += q;
        } else if (roll < 0.75) {
          entries.push({
            id,
            direction: 'OUT',
            qty: q,
            preVatAmount: q * 150,
            transactionDate: date,
          });
          expectedBalance -= q;
        } else if (roll < 0.88) {
          entries.push({
            id,
            direction: 'OUT',
            qty: q,
            adjSign: -1,
            isAdjustment: true,
            preVatAmount: q * 150,
            transactionDate: date,
          });
          expectedBalance += q;
        } else {
          entries.push({
            id,
            direction: 'IN',
            qty: q,
            adjSign: -1,
            isAdjustment: true,
            preVatAmount: q * 100,
            transactionDate: date,
          });
          expectedBalance -= q;
        }
      }

      const result = calculateLedgerHistoryCogs(entries);
      const last = result[result.length - 1];
      expect(last.balanceQty).toBeCloseTo(expectedBalance, 4);
    }
  });
});
