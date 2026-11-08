import {
  nextPartnerCode,
  normalizePartnerCode,
  partnerCodePrefix,
  storedPartnerType,
} from './erp-business-partner-code.helper';

describe('erp-business-partner-code.helper', () => {
  it('normalizes a typed code by trimming and upper-casing it', () => {
    expect(normalizePartnerCode('  kh-010 ')).toBe('KH-010');
  });

  it('uses NCC- for vendors (and the default), KH- for customers, DT- for other types', () => {
    expect(partnerCodePrefix('VENDOR')).toBe('NCC-');
    expect(partnerCodePrefix(undefined)).toBe('NCC-');
    expect(partnerCodePrefix('customer')).toBe('KH-');
    expect(partnerCodePrefix('OTHER')).toBe('DT-');
  });

  it('stores vendor and customer types in canonical form and keeps other types as-is', () => {
    expect(storedPartnerType(undefined)).toBe('VENDOR');
    expect(storedPartnerType('customer')).toBe('CUSTOMER');
    expect(storedPartnerType('OTHER')).toBe('OTHER');
  });

  it('starts at 001 when no code exists', () => {
    expect(nextPartnerCode([], 'VENDOR')).toBe('NCC-001');
  });

  it('continues from the largest trailing number and ignores codes without digits', () => {
    expect(
      nextPartnerCode(
        ['NCC-002', 'NCC-010', 'NCC-XYZ', '', 'NCC-009'],
        'VENDOR',
      ),
    ).toBe('NCC-011');
  });

  it('pads the sequence to three digits and grows past 999 without truncation', () => {
    expect(nextPartnerCode(['KH-009'], 'CUSTOMER')).toBe('KH-010');
    expect(nextPartnerCode(['KH-999'], 'CUSTOMER')).toBe('KH-1000');
  });
});
