import {
  CATEGORY_TO_DEBIT_ACCOUNT_MAP,
  FALLBACK_PURCHASE_DEBIT_ACCOUNT,
  resolveInvoiceAccountsByCategory,
  STANDARD_AP_CREDIT_ACCOUNT,
  STANDARD_VAT_DEBIT_ACCOUNT,
} from './invoice-category-account-mapping.helper';

describe('InvoiceCategoryAccountMappingHelper', () => {
  it('should map VF_PARTS to 1561', () => {
    const res = resolveInvoiceAccountsByCategory('VF_PARTS');
    expect(res.debitAccountCode).toBe('1561');
    expect(res.vatAccountCode).toBe(STANDARD_VAT_DEBIT_ACCOUNT);
    expect(res.creditAccountCode).toBe(STANDARD_AP_CREDIT_ACCOUNT);
    expect(res.isFallback).toBe(false);
  });

  it('should map COMMERCIAL_VEHICLES to 1562', () => {
    const res = resolveInvoiceAccountsByCategory('COMMERCIAL_VEHICLES');
    expect(res.debitAccountCode).toBe('1562');
  });

  it('should map OEM_OTHER_PARTS to 1563', () => {
    const res = resolveInvoiceAccountsByCategory('OEM_OTHER_PARTS');
    expect(res.debitAccountCode).toBe('1563');
  });

  it('should map WORKSHOP_CONSUMABLES to 152', () => {
    const res = resolveInvoiceAccountsByCategory('WORKSHOP_CONSUMABLES');
    expect(res.debitAccountCode).toBe('152');
  });

  it('should map GARAGE_SUBCONTRACT to 632', () => {
    const res = resolveInvoiceAccountsByCategory('GARAGE_SUBCONTRACT');
    expect(res.debitAccountCode).toBe('632');
  });

  it('should map GARAGE_TOOLS_EQUIPMENT and OFFICE_IT_FACILITIES to 153', () => {
    expect(
      resolveInvoiceAccountsByCategory('GARAGE_TOOLS_EQUIPMENT')
        .debitAccountCode,
    ).toBe('153');
    expect(
      resolveInvoiceAccountsByCategory('OFFICE_IT_FACILITIES').debitAccountCode,
    ).toBe('153');
  });

  it('should map OPEX_LOGISTICS to 6427 (Grab, 911, Viettel Post)', () => {
    const res = resolveInvoiceAccountsByCategory('OPEX_LOGISTICS');
    expect(res.debitAccountCode).toBe('6427');
  });

  it('should map OPEX_SECURITY_CLEANING to 6427', () => {
    const res = resolveInvoiceAccountsByCategory('OPEX_SECURITY_CLEANING');
    expect(res.debitAccountCode).toBe('6427');
  });

  it('should map OPEX_BANK_FEES to 635', () => {
    const res = resolveInvoiceAccountsByCategory('OPEX_BANK_FEES');
    expect(res.debitAccountCode).toBe('635');
  });

  it('should map OPEX_ADMIN to 6422', () => {
    const res = resolveInvoiceAccountsByCategory('OPEX_ADMIN');
    expect(res.debitAccountCode).toBe('6422');
  });

  it('should map OPEX_LEGAL_CONSULTING to 6427 and OPEX_IT_SOFTWARE to 6427', () => {
    expect(
      resolveInvoiceAccountsByCategory('OPEX_LEGAL_CONSULTING')
        .debitAccountCode,
    ).toBe('6427');
    expect(
      resolveInvoiceAccountsByCategory('OPEX_IT_SOFTWARE').debitAccountCode,
    ).toBe('6427');
  });

  it('should map OPEX_MARKETING to 6428', () => {
    const res = resolveInvoiceAccountsByCategory('OPEX_MARKETING');
    expect(res.debitAccountCode).toBe('6428');
  });

  it('should fallback to T0003 when category is null, empty or unknown', () => {
    const resNull = resolveInvoiceAccountsByCategory(null);
    expect(resNull.debitAccountCode).toBe(FALLBACK_PURCHASE_DEBIT_ACCOUNT);
    expect(resNull.isFallback).toBe(true);

    const resEmpty = resolveInvoiceAccountsByCategory('');
    expect(resEmpty.debitAccountCode).toBe(FALLBACK_PURCHASE_DEBIT_ACCOUNT);
    expect(resEmpty.isFallback).toBe(true);

    const resUnknown = resolveInvoiceAccountsByCategory('UNKNOWN_CAT');
    expect(resUnknown.debitAccountCode).toBe(FALLBACK_PURCHASE_DEBIT_ACCOUNT);
    expect(resUnknown.isFallback).toBe(true);
  });

  it('should have exactly 14 category keys in CATEGORY_TO_DEBIT_ACCOUNT_MAP', () => {
    expect(Object.keys(CATEGORY_TO_DEBIT_ACCOUNT_MAP)).toHaveLength(14);
  });

  describe('3-Tier Fallback with DB overrideDebitAccountCode', () => {
    it('should prioritize DB overrideDebitAccountCode over static TT99 map (Tier 1)', () => {
      const res = resolveInvoiceAccountsByCategory('VF_PARTS', '6421');
      expect(res.debitAccountCode).toBe('6421');
      expect(res.categoryCode).toBe('VF_PARTS');
      expect(res.isFallback).toBe(false);
    });

    it('should fallback to static TT99 map when override is null or empty (Tier 2)', () => {
      const resNull = resolveInvoiceAccountsByCategory('VF_PARTS', null);
      expect(resNull.debitAccountCode).toBe('1561');
      expect(resNull.isFallback).toBe(false);

      const resEmpty = resolveInvoiceAccountsByCategory('VF_PARTS', '   ');
      expect(resEmpty.debitAccountCode).toBe('1561');
      expect(resEmpty.isFallback).toBe(false);
    });

    it('should fallback to T0003 when override is empty and category is unknown (Tier 3)', () => {
      const res = resolveInvoiceAccountsByCategory('CUSTOM_CAT', '');
      expect(res.debitAccountCode).toBe(FALLBACK_PURCHASE_DEBIT_ACCOUNT);
      expect(res.isFallback).toBe(true);
    });

    it('should use DB override even when categoryCode is null or empty', () => {
      const res = resolveInvoiceAccountsByCategory(null, '6422');
      expect(res.debitAccountCode).toBe('6422');
      expect(res.categoryCode).toBeNull();
      expect(res.isFallback).toBe(false);
    });
  });
});
