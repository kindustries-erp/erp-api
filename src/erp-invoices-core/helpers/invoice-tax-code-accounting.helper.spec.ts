import {
  resolvePurchaseDebitAccountCode,
  TAX_CODES_642,
  TAX_CODES_632_EXPLICIT,
} from './invoice-tax-code-accounting.helper';

describe('InvoiceTaxCodeAccountingHelper', () => {
  it('should map 642 tax codes to 642', () => {
    for (const code of TAX_CODES_642) {
      expect(resolvePurchaseDebitAccountCode(code)).toBe('642');
      expect(resolvePurchaseDebitAccountCode(`  ${code}  `)).toBe('642');
    }
  });

  it('should map explicit 632 tax codes to 632', () => {
    for (const code of TAX_CODES_632_EXPLICIT) {
      expect(resolvePurchaseDebitAccountCode(code)).toBe('632');
    }
  });

  it('should fallback all other unknown tax codes to 632', () => {
    expect(resolvePurchaseDebitAccountCode('9999999999')).toBe('632');
    expect(resolvePurchaseDebitAccountCode('')).toBe('632');
    expect(resolvePurchaseDebitAccountCode(null)).toBe('632');
    expect(resolvePurchaseDebitAccountCode(undefined)).toBe('632');
  });
});
