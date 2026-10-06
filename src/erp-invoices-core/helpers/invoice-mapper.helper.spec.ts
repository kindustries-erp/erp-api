import {
  parseVatRateForDisplay,
  formatVatRate,
  toInvoiceDto,
} from './invoice-mapper.helper';

describe('invoice-mapper.helper', () => {
  describe('formatVatRate', () => {
    it('returns empty string for null, undefined, or empty string', () => {
      expect(formatVatRate(null)).toBe('');
      expect(formatVatRate(undefined)).toBe('');
      expect(formatVatRate('')).toBe('');
      expect(formatVatRate('   ')).toBe('');
    });

    it('formats decimal numbers to percentage string', () => {
      expect(formatVatRate(0.08)).toBe('8%');
      expect(formatVatRate('0.08')).toBe('8%');
      expect(formatVatRate(0.1)).toBe('10%');
      expect(formatVatRate('0.1')).toBe('10%');
      expect(formatVatRate(0.05)).toBe('5%');
      expect(formatVatRate(0.0525)).toBe('5.25%');
    });

    it('formats integer percentages to percentage string', () => {
      expect(formatVatRate(8)).toBe('8%');
      expect(formatVatRate('8')).toBe('8%');
      expect(formatVatRate(10)).toBe('10%');
      expect(formatVatRate('10')).toBe('10%');
      expect(formatVatRate(0)).toBe('0%');
      expect(formatVatRate('0')).toBe('0%');
    });

    it('preserves strings already containing percentage symbol', () => {
      expect(formatVatRate('8%')).toBe('8%');
      expect(formatVatRate('10%')).toBe('10%');
      expect(formatVatRate('0%')).toBe('0%');
    });

    it('preserves non-numeric tax rate strings like KCT, KKKNT, KHAC', () => {
      expect(formatVatRate('KCT')).toBe('KCT');
      expect(formatVatRate('KKKNT')).toBe('KKKNT');
      expect(formatVatRate('KHAC')).toBe('KHAC');
      expect(formatVatRate('Không chịu thuế')).toBe('Không chịu thuế');
    });
  });

  describe('parseVatRateForDisplay', () => {
    it('normalizes integer percentages > 1 to fractions', () => {
      expect(parseVatRateForDisplay('8')).toBe(0.08);
      expect(parseVatRateForDisplay(10)).toBe(0.1);
    });

    it('keeps fractions as is', () => {
      expect(parseVatRateForDisplay('0.08')).toBe(0.08);
      expect(parseVatRateForDisplay(0.1)).toBe(0.1);
    });
  });
});
