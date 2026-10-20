import {
  VINFAST_LEDGER_ORDER_SQL,
  VINFAST_VALID_STATUS_SQL,
  isVinfastLabourCode,
  isVinfastServicePrefix,
  resolveAdjustmentLedgerQty,
} from './vinfast-ledger-rules.helper';

describe('vinfast-ledger-rules.helper', () => {
  describe('VINFAST_VALID_STATUS_SQL', () => {
    it('should count status 1,2,3,5 and exclude 4 (replaced original) and 6 (cancelled)', () => {
      expect(VINFAST_VALID_STATUS_SQL).toBe('(1, 2, 3, 5)');
    });
  });

  describe('VINFAST_LEDGER_ORDER_SQL', () => {
    it('should order same-day IN before OUT with stable tiebreakers', () => {
      expect(VINFAST_LEDGER_ORDER_SQL).toContain(
        "CASE WHEN l.direction = 'IN' THEN 0 ELSE 1 END",
      );
      expect(VINFAST_LEDGER_ORDER_SQL).toContain('l.id ASC');
    });
  });

  describe('resolveAdjustmentLedgerQty', () => {
    it('should treat negative quantity as a reversal with adjSign -1', () => {
      expect(
        resolveAdjustmentLedgerQty({
          quantity: -2,
          description: 'Hàng trả lại',
        }),
      ).toEqual({ qty: 2, adjSign: -1 });
    });

    it('should count positive quantity only when description says "tăng số lượng"', () => {
      expect(
        resolveAdjustmentLedgerQty({
          quantity: 3,
          description: 'Điều chỉnh tăng số lượng hàng hóa',
        }),
      ).toEqual({ qty: 3, adjSign: 1 });
    });

    it('should treat money-only adjustments (price change) as zero quantity', () => {
      expect(
        resolveAdjustmentLedgerQty({
          quantity: 1,
          description: 'Điều chỉnh giảm đơn giá của hàng hóa',
        }),
      ).toEqual({ qty: 0, adjSign: 1 });
    });

    it('should treat null quantity as zero quantity', () => {
      expect(
        resolveAdjustmentLedgerQty({ quantity: null, description: 'x' }),
      ).toEqual({ qty: 0, adjSign: 1 });
    });
  });

  describe('isVinfastServicePrefix', () => {
    it('should flag known service prefixes as service', () => {
      expect(isVinfastServicePrefix('VF-LFP00000216')).toBe(true);
      expect(isVinfastServicePrefix('VF-EEH00000116')).toBe(true);
      expect(isVinfastServicePrefix('VF-QTS52801')).toBe(true);
      expect(isVinfastServicePrefix('VF-XSH853466')).toBe(true);
    });

    it('should not flag numeric codes or physical parts by prefix', () => {
      expect(isVinfastServicePrefix('VF-60103001')).toBe(false);
      expect(isVinfastServicePrefix('VF-BEX20000923')).toBe(false);
      expect(isVinfastServicePrefix('VF-EEP73110011AP')).toBe(false);
    });
  });

  describe('isVinfastLabourCode', () => {
    it('should flag numeric labour codes', () => {
      expect(isVinfastLabourCode('VF-60103001')).toBe(true);
    });

    it('should not flag alphanumeric part numbers', () => {
      expect(isVinfastLabourCode('VF-BEX20000923')).toBe(false);
    });
  });
});
