import { normalizeInvoiceNo } from './invoice-no.helper';

describe('normalizeInvoiceNo', () => {
  it('drops leading zeros of the trailing number', () => {
    expect(normalizeInvoiceNo('0000123')).toBe('123');
    expect(normalizeInvoiceNo('AB-00045')).toBe('AB-45');
  });

  it('trims surrounding spaces first', () => {
    expect(normalizeInvoiceNo('  INV-007 ')).toBe('INV-7');
  });

  it('returns null for empty input', () => {
    expect(normalizeInvoiceNo(null)).toBeNull();
    expect(normalizeInvoiceNo('')).toBeNull();
  });
});
