import {
  calculateCashflowStats,
  computeCaseBalancesAfterSettlement,
  sanitizePaymentMethod,
} from './garage-cashflow-calc.engine';

describe('GarageCashflowCalcEngine (Pattern C)', () => {
  describe('calculateCashflowStats', () => {
    it('calculates correct stats for empty items', () => {
      const stats = calculateCashflowStats([]);
      expect(stats).toEqual({
        totalReceipts: 0,
        totalPayments: 0,
        netCashflow: 0,
        totalTransactions: 0,
        linkedCasesCount: 0,
      });
    });

    it('calculates receipts, payments, net cashflow and unique cases correctly', () => {
      const items = [
        { settlementType: 'RECEIPT', amount: 5000000, caseId: 'case-1' },
        { settlementType: 'RECEIPT', amount: 3000000, caseId: 'case-1' },
        { settlementType: 'RECEIPT', amount: 2000000, caseId: 'case-2' },
        { settlementType: 'PAYMENT', amount: 1500000, caseId: 'case-1' },
        { settlementType: 'PAYMENT', amount: 500000, caseId: null },
      ];

      const stats = calculateCashflowStats(items);
      expect(stats.totalReceipts).toBe(10000000);
      expect(stats.totalPayments).toBe(2000000);
      expect(stats.netCashflow).toBe(8000000);
      expect(stats.totalTransactions).toBe(5);
      expect(stats.linkedCasesCount).toBe(2);
    });
  });

  describe('computeCaseBalancesAfterSettlement', () => {
    it('computes total paid and remaining correctly', () => {
      const res = computeCaseBalancesAfterSettlement(5000000, [
        { amount: 2000000 },
        { amount: 1500000 },
      ]);
      expect(res.totalPaid).toBe(3500000);
      expect(res.remaining).toBe(1500000);
    });

    it('clamps remaining to 0 when paid exceeds target', () => {
      const res = computeCaseBalancesAfterSettlement(5000000, [
        { amount: 6000000 },
      ]);
      expect(res.totalPaid).toBe(6000000);
      expect(res.remaining).toBe(0);
    });
  });

  describe('sanitizePaymentMethod', () => {
    it('fallbacks to BANK_TRANSFER when hasBankTxn is true', () => {
      expect(sanitizePaymentMethod(undefined, true)).toBe('BANK_TRANSFER');
      expect(sanitizePaymentMethod(undefined, false)).toBe('CASH');
    });

    it('normalizes method strings', () => {
      expect(sanitizePaymentMethod('CHUYEN_KHOAN')).toBe('BANK_TRANSFER');
      expect(sanitizePaymentMethod('TIEN_MAT')).toBe('CASH');
      expect(sanitizePaymentMethod('SMARTPAY')).toBe('POS');
      expect(sanitizePaymentMethod('UNKNOWN')).toBe('OTHER');
    });
  });
});
