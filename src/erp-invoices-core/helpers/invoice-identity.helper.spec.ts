import {
  buildInvoiceIdentityWhere,
  pickOriginalInvoiceCandidate,
} from './invoice-identity.helper';

describe('pickOriginalInvoiceCandidate', () => {
  it('returns the only candidate unchanged', () => {
    const only = { invoiceDate: '2025-03-01' };

    expect(pickOriginalInvoiceCandidate([only], '2026-08-01')).toBe(only);
  });

  it('picks the latest original issued on or before the replacing invoice', () => {
    const y2024 = { invoiceDate: '2024-05-01' };
    const y2025 = { invoiceDate: '2025-05-01' };
    const y2026 = { invoiceDate: '2026-09-01' };

    expect(
      pickOriginalInvoiceCandidate([y2026, y2024, y2025], '2026-08-31'),
    ).toBe(y2025);
  });

  it('returns null when every candidate is after the replacing invoice', () => {
    expect(
      pickOriginalInvoiceCandidate(
        [{ invoiceDate: '2026-09-01' }, { invoiceDate: '2027-01-01' }],
        '2026-08-31',
      ),
    ).toBeNull();
  });

  it('returns null for no candidates', () => {
    expect(pickOriginalInvoiceCandidate([], '2026-08-31')).toBeNull();
  });
});

describe('buildInvoiceIdentityWhere', () => {
  const base = {
    direction: 'IN' as const,
    invoiceNo: '8100897',
    serialNo: 'K26TAN',
    counterpartyTaxCode: '0104093672',
    invoiceDate: '2026-08-31',
  };

  it('matches the seller tax code for purchase invoices', () => {
    const where: any = buildInvoiceIdentityWhere(base);

    expect(where.sellerTaxCode).toBe('0104093672');
    expect(where).not.toHaveProperty('buyerTaxCode');
    expect(where.direction).toBe('IN');
    expect(where.invoiceNo).toBe('8100897');
    expect(where.serialNo).toBe('K26TAN');
    expect(where.isDeleted).toBe(false);
  });

  it('matches the buyer tax code for sold invoices', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      direction: 'OUT',
      counterpartyTaxCode: '0318334886-003',
    });

    expect(where.buyerTaxCode).toBe('0318334886-003');
    expect(where).not.toHaveProperty('sellerTaxCode');
    expect(where.direction).toBe('OUT');
  });

  it('limits the match to the invoice year, so the same number in another year is a different invoice', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      invoiceDate: '2025-08-31',
    });

    expect(where.invoiceDate.type).toBe('between');
    expect(where.invoiceDate.value).toEqual(['2025-01-01', '2025-12-31']);
  });

  it('matches any date in the same year, so the same invoice on another day is not inserted twice', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      invoiceDate: '2026-12-30',
    });

    expect(where.invoiceDate.value).toEqual(['2026-01-01', '2026-12-31']);
  });

  it('uses IS NULL for a missing serial number instead of dropping the condition', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      serialNo: null,
    });

    expect(where.serialNo.type).toBe('isNull');
  });

  it('adds the total amount to the match when given', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      totalAmount: '1000000.00',
    });

    expect(where.totalAmount).toBe('1000000.00');
  });

  it('does not filter by amount when not given, so the key-only lookup can detect amount conflicts', () => {
    const where: any = buildInvoiceIdentityWhere(base);

    expect(where).not.toHaveProperty('totalAmount');
  });

  it('uses IS NULL for a missing counterparty tax code', () => {
    const where: any = buildInvoiceIdentityWhere({
      ...base,
      counterpartyTaxCode: null,
    });

    expect(where.sellerTaxCode.type).toBe('isNull');
  });
});
