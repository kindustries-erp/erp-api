import {
  calculateFifoUnitRows,
  calculateLedgerHistoryCogs,
  LedgerEntryForFifo,
} from './vinfast-fifo.engine';

describe('vinfast-fifo.engine', () => {
  describe('calculateFifoUnitRows', () => {
    it('should correctly pair IN units with OUT units and calculate COGS and profit', () => {
      const entries: LedgerEntryForFifo[] = [
        {
          id: 'in-1',
          direction: 'IN',
          qty: 2,
          unitCost: 100000,
          preVatAmount: 200000,
          transactionDate: '2026-01-01',
          invoiceNo: 'INV-IN-1',
          invoiceId: 'inv-1',
        },
        {
          id: 'out-1',
          direction: 'OUT',
          qty: 1,
          unitCost: 150000,
          preVatAmount: 150000,
          transactionDate: '2026-01-05',
          invoiceNo: 'INV-OUT-1',
          invoiceId: 'inv-2',
          licensePlate: '51A-12345',
        },
      ];

      const result = calculateFifoUnitRows(entries);

      expect(result).toHaveLength(2);
      // Row 0: Remaining in stock (qty: 1, IN_STOCK)
      expect(result[0].status).toBe('IN_STOCK');
      expect(result[0].qty).toBe(1);
      expect(result[0].inUnitCost).toBe(100000);

      // Row 1: Sold unit (qty: 1, SOLD, cost 100k, price 150k, profit 50k)
      expect(result[1].status).toBe('SOLD');
      expect(result[1].qty).toBe(1);
      expect(result[1].inUnitCost).toBe(100000);
      expect(result[1].outPrice).toBe(150000);
      expect(result[1].cogsFifo).toBe(100000);
      expect(result[1].profit).toBe(50000);
      expect(result[1].licensePlate).toBe('51A-12345');
    });

    it('should handle full consumption and multiple FIFO batches', () => {
      const entries: LedgerEntryForFifo[] = [
        {
          id: 'in-1',
          direction: 'IN',
          qty: 1,
          unitCost: 100,
          preVatAmount: 100,
          transactionDate: '2026-01-01',
        },
        {
          id: 'in-2',
          direction: 'IN',
          qty: 2,
          unitCost: 200,
          preVatAmount: 400,
          transactionDate: '2026-01-02',
        },
        {
          id: 'out-1',
          direction: 'OUT',
          qty: 2,
          unitCost: 300,
          preVatAmount: 600,
          transactionDate: '2026-01-03',
        },
      ];

      const result = calculateFifoUnitRows(entries);

      expect(result).toHaveLength(3);
      // Row 0: Fully consumed in-1
      expect(result[0].status).toBe('SOLD');
      expect(result[0].cogsFifo).toBe(100);
      expect(result[0].qty).toBe(1);

      // Row 1: Remaining in-2 (1 unit)
      expect(result[1].status).toBe('IN_STOCK');
      expect(result[1].inUnitCost).toBe(200);
      expect(result[1].qty).toBe(1);

      // Row 2: Consumed 1 unit from in-2
      expect(result[2].status).toBe('SOLD');
      expect(result[2].cogsFifo).toBe(200);
      expect(result[2].qty).toBe(1);
    });
  });

  describe('calculateLedgerHistoryCogs', () => {
    it('should assign calculated COGS and unit cost to OUT transactions', () => {
      const entries: LedgerEntryForFifo[] = [
        {
          id: 'in-1',
          direction: 'IN',
          qty: 2,
          unitCost: 100000,
          preVatAmount: 200000,
          transactionDate: '2026-01-01',
        },
        {
          id: 'out-1',
          direction: 'OUT',
          qty: 1,
          preVatAmount: 150000,
          transactionDate: '2026-01-05',
        },
      ];

      const result = calculateLedgerHistoryCogs(entries);

      expect(result[0].calculatedCogs).toBeNull();
      expect(result[1].calculatedCogs).toBe(100000);
      expect(result[1].calculatedUnitCost).toBe(100000);
    });
  });
});
