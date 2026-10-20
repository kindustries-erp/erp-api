import {
  calculateFifoUnitRows,
  calculateLedgerHistoryCogs,
  LedgerEntryForFifo,
} from './vinfast-fifo.engine';

const IN_100K: LedgerEntryForFifo = {
  id: 'in-1',
  direction: 'IN',
  qty: 2,
  unitCost: 100000,
  preVatAmount: 200000,
  transactionDate: '2026-01-01',
  invoiceNo: 'INV-IN-1',
  invoiceId: 'inv-in-1',
};

const OUT_2_AT_150K: LedgerEntryForFifo = {
  id: 'out-1',
  direction: 'OUT',
  qty: 2,
  unitCost: 150000,
  preVatAmount: 300000,
  transactionDate: '2026-01-05',
  invoiceNo: 'INV-OUT-1',
  invoiceId: 'inv-out-1',
};

describe('vinfast-fifo engine: returns and shortages', () => {
  describe('calculateFifoUnitRows', () => {
    it('should put a returned unit back into stock when a reversal OUT (adjSign -1) follows a sale', () => {
      const result = calculateFifoUnitRows([
        IN_100K,
        OUT_2_AT_150K,
        {
          id: 'ret-1',
          direction: 'OUT',
          qty: 1,
          adjSign: -1,
          isAdjustment: true,
          unitCost: 150000,
          preVatAmount: 150000,
          transactionDate: '2026-01-07',
          invoiceNo: 'INV-RET-1',
          invoiceId: 'inv-ret-1',
        },
      ]);

      const returned = result.filter((r) => r.status === 'RETURNED');
      expect(returned).toHaveLength(1);
      expect(returned[0].qty).toBe(1);
      expect(returned[0].inUnitCost).toBe(100000);
      expect(returned[0].returnLedgerId).toBe('ret-1');

      const stockQty = result
        .filter((r) => r.status === 'IN_STOCK' || r.status === 'RETURNED')
        .reduce((sum, r) => sum + (r.qty ?? 0), 0);
      expect(stockQty).toBe(1);
    });

    it('should emit a SHORTAGE row when an OUT exceeds available stock', () => {
      const result = calculateFifoUnitRows([
        { ...IN_100K, qty: 1 },
        { ...OUT_2_AT_150K, qty: 3, preVatAmount: 450000 },
      ]);

      const shortage = result.filter((r) => r.status === 'SHORTAGE');
      expect(shortage).toHaveLength(1);
      expect(shortage[0].qty).toBe(2);
      expect(shortage[0].outPrice).toBe(150000);
      expect(shortage[0].cogsFifo).toBeNull();
    });

    it('should keep stock minus shortage equal to the signed balance across mixed entries', () => {
      const entries: LedgerEntryForFifo[] = [
        { ...IN_100K, qty: 5 },
        { ...OUT_2_AT_150K, qty: 2 },
        {
          ...OUT_2_AT_150K,
          id: 'out-2',
          qty: 4,
          transactionDate: '2026-01-09',
        },
      ];

      const result = calculateFifoUnitRows(entries);
      const inStock = result
        .filter((r) => r.status === 'IN_STOCK' || r.status === 'RETURNED')
        .reduce((sum, r) => sum + (r.qty ?? 0), 0);
      const shortage = result
        .filter((r) => r.status === 'SHORTAGE')
        .reduce((sum, r) => sum + (r.qty ?? 0), 0);

      // 5 nhập - (2 + 4) xuất = -1  ->  tồn 0 và thiếu 1
      expect(inStock - shortage).toBe(-1);
      expect(shortage).toBe(1);
    });
  });

  describe('calculateLedgerHistoryCogs', () => {
    it('should give the reversal row a negative COGS equal to the cost of the returned units', () => {
      const result = calculateLedgerHistoryCogs([
        IN_100K,
        OUT_2_AT_150K,
        {
          id: 'ret-1',
          direction: 'OUT',
          qty: 1,
          adjSign: -1,
          isAdjustment: true,
          unitCost: 150000,
          preVatAmount: 150000,
          transactionDate: '2026-01-07',
        },
      ]);

      expect(result[1].calculatedCogs).toBe(200000);
      expect(result[2].calculatedCogs).toBe(-100000);
    });
  });
});
