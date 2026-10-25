import {
  CASHFLOW_PURPOSES,
  CASHFLOW_PURPOSES_BY_CLASSIFICATION,
  isPurposeAllowed,
} from './cashflow-attributes.constants';

describe('cashflow-attributes constants', () => {
  it('every purpose belongs to at least one classification', () => {
    const mapped = new Set(
      Object.values(CASHFLOW_PURPOSES_BY_CLASSIFICATION).flat(),
    );
    for (const purpose of CASHFLOW_PURPOSES) {
      expect(mapped.has(purpose)).toBe(true);
    }
  });

  it('mapping only contains known purposes', () => {
    const known = new Set<string>(CASHFLOW_PURPOSES);
    for (const list of Object.values(CASHFLOW_PURPOSES_BY_CLASSIFICATION)) {
      for (const purpose of list) {
        expect(known.has(purpose)).toBe(true);
      }
    }
  });

  it('accepts valid pairs and rejects cross-group pairs', () => {
    expect(isPurposeAllowed('FINANCING', 'LOAN')).toBe(true);
    expect(isPurposeAllowed('INVESTING', 'ASSET_PURCHASE')).toBe(true);
    expect(isPurposeAllowed('FINANCING', 'SALARY')).toBe(false);
    expect(isPurposeAllowed('OPERATING', 'LOAN')).toBe(false);
  });

  it('accepts the added purposes under their classification', () => {
    expect(isPurposeAllowed('OPERATING', 'INSURANCE_CLAIM')).toBe(true);
    expect(isPurposeAllowed('OPERATING', 'RENT')).toBe(true);
    expect(isPurposeAllowed('OPERATING', 'BANK_FEE')).toBe(true);
    expect(isPurposeAllowed('OPERATING', 'ADVANCE')).toBe(true);
    expect(isPurposeAllowed('OPERATING', 'REFUND')).toBe(true);
    expect(isPurposeAllowed('OPERATING', 'SOCIAL_INSURANCE')).toBe(true);
    expect(isPurposeAllowed('INVESTING', 'INTEREST_INCOME')).toBe(true);
    expect(isPurposeAllowed('FINANCING', 'INSURANCE_CLAIM')).toBe(false);
    expect(isPurposeAllowed('INVESTING', 'RENT')).toBe(false);
  });

  it('allows empty purpose and rejects purpose without classification', () => {
    expect(isPurposeAllowed(null, null)).toBe(true);
    expect(isPurposeAllowed(undefined, undefined)).toBe(true);
    expect(isPurposeAllowed(null, 'LOAN')).toBe(false);
  });
});
