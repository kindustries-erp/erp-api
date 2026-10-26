import { classifyCashflowByInvoiceLink } from './cashflow-invoice-link-classifier';

describe('classifyCashflowByInvoiceLink', () => {
  it('maps inflows linked only to sales invoices to customer payments', () => {
    expect(
      classifyCashflowByInvoiceLink({
        isIn: true,
        invoiceDirections: ['OUT', 'OUT'],
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'OPERATING',
        purpose: 'CUSTOMER_PAYMENT',
      }),
    );
  });

  it('maps outflows linked only to purchase invoices to supplier payments', () => {
    expect(
      classifyCashflowByInvoiceLink({
        isIn: false,
        invoiceDirections: ['IN'],
      }),
    ).toEqual(
      expect.objectContaining({
        classification: 'OPERATING',
        purpose: 'SUPPLIER_PAYMENT',
      }),
    );
  });

  it('returns null when there is no linked invoice', () => {
    expect(
      classifyCashflowByInvoiceLink({ isIn: true, invoiceDirections: [] }),
    ).toBeNull();
  });

  it('returns null when direction is mismatched', () => {
    expect(
      classifyCashflowByInvoiceLink({
        isIn: true,
        invoiceDirections: ['IN'],
      }),
    ).toBeNull();
    expect(
      classifyCashflowByInvoiceLink({
        isIn: false,
        invoiceDirections: ['OUT'],
      }),
    ).toBeNull();
  });

  it('returns null when linked invoices mix directions', () => {
    expect(
      classifyCashflowByInvoiceLink({
        isIn: true,
        invoiceDirections: ['OUT', 'IN'],
      }),
    ).toBeNull();
  });
});
