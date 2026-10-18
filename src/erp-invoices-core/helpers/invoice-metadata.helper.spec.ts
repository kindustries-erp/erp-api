import { extractInvoiceMetadata } from './invoice-metadata.helper';

describe('InvoiceMetadataHelper', () => {
  it('should extract license plate with dots (e.g., 50F-090.80)', () => {
    const invoice: any = {
      description: 'Sửa chữa xe 50F-090.80 theo lệnh GR-12345',
      items: [],
    };
    extractInvoiceMetadata(invoice);
    expect(invoice.licensePlate).toBe('50F-090.80');
    expect(invoice.settlementOrder).toBe('GR-12345');
  });

  it('should extract license plate from line items', () => {
    const invoice: any = {
      description: 'Dịch vụ sửa chữa',
      items: [{ description: 'Bảo dưỡng xe 50H-319.73 theo lệnh QT-WO-9988' }],
    };
    extractInvoiceMetadata(invoice);
    expect(invoice.licensePlate).toBe('50H-319.73');
    expect(invoice.settlementOrder).toBe('-WO-9988');
  });

  it('should extract standard 4-digit and 5-digit license plates', () => {
    const invoice1: any = { description: 'Bảo dưỡng xe 51G-1234' };
    extractInvoiceMetadata(invoice1);
    expect(invoice1.licensePlate).toBe('51G-1234');

    const invoice2: any = { description: 'Bảo dưỡng xe 89A-482.19' };
    extractInvoiceMetadata(invoice2);
    expect(invoice2.licensePlate).toBe('89A-482.19');

    const invoice3: any = { description: 'Bảo dưỡng xe 50E82434' };
    extractInvoiceMetadata(invoice3);
    expect(invoice3.licensePlate).toBe('50E82434');
  });

  it('should handle invoices without plate or settlement order gracefully', () => {
    const invoice: any = {
      description: 'Mua văn phòng phẩm tháng 9',
      items: [{ description: 'Giấy in A4' }],
    };
    extractInvoiceMetadata(invoice);
    expect(invoice.licensePlate).toBeUndefined();
    expect(invoice.settlementOrder).toBeUndefined();
  });
});
