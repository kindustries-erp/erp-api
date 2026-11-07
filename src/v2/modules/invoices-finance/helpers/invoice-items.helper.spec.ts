import { buildInvoiceItems } from './invoice-items.helper';

const ctx = {
  direction: 'IN',
  sellerName: 'NHA CUNG CAP',
  sellerTaxCode: '0100000001',
};

describe('buildInvoiceItems', () => {
  it('stringifies amounts and defaults the subcategory', () => {
    const [row] = buildInvoiceItems(
      [
        {
          description: 'Dầu nhớt',
          unit: ' lít ',
          quantity: 2,
          unitPrice: 50000,
          preVatAmount: 100000,
          totalAmount: 110000,
        },
      ],
      ctx,
    );
    expect(row.invoiceSubcategory).toBe('NORMAL');
    expect(row.unit).toBe('LÍT');
    expect(row.quantity).toBe('2');
    expect(row.unitPrice).toBe('50000');
    expect(row.preVatAmount).toBe('100000');
    expect(row.vatAmount).toBe('0');
    expect(row.totalAmount).toBe('110000');
  });

  it('applies the v1 prefix rule to the preserved code on update', () => {
    const [row] = buildInvoiceItems([{ description: '  Lọc gió ' }], ctx, [
      { description: 'Lọc gió', itemCode: 'MA-OLD' },
    ]);
    expect(row.itemCode).toBe('PT-MA-OLD');
  });

  it('applies the v1 prefix rule to the submitted item code', () => {
    const [row] = buildInvoiceItems(
      [{ description: 'Khác', itemCode: 'MA-NEW' }],
      ctx,
    );
    expect(row.itemCode).toBe('PT-MA-NEW');
  });
});
