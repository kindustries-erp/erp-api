import { extractInvoiceMetadata } from './invoice-metadata.helper';

describe('extractInvoiceMetadata', () => {
  it('extracts settlement order and strips the QT prefix', () => {
    const invoice: any = { description: 'QT50-WO-123 sửa chữa', items: [] };
    extractInvoiceMetadata(invoice);
    expect(invoice.settlementOrder).toBe('50-WO-123');
  });

  it('extracts license plate from item descriptions', () => {
    const invoice: any = {
      description: '',
      items: [{ description: 'xe 50H-38666' }],
    };
    extractInvoiceMetadata(invoice);
    expect(invoice.licensePlate).toBe('50H-38666');
  });

  it('keeps existing values when nothing matches', () => {
    const invoice: any = {
      description: 'hàng hóa',
      settlementOrder: 'OLD',
      licensePlate: 'OLD',
    };
    extractInvoiceMetadata(invoice);
    expect(invoice.settlementOrder).toBe('OLD');
    expect(invoice.licensePlate).toBe('OLD');
  });
});
