import { BadRequestException } from '@nestjs/common';
import {
  assertInvoiceFile,
  invoiceUploadFilter,
} from './invoice-upload.helper';

describe('invoice-upload.helper', () => {
  it('fileFilter nhận ảnh/PDF, từ chối loại khác', () => {
    const ok = jest.fn();
    invoiceUploadFilter({}, { mimetype: 'application/pdf' }, ok);
    expect(ok).toHaveBeenCalledWith(null, true);

    const bad = jest.fn();
    invoiceUploadFilter({}, { mimetype: 'text/html' }, bad);
    expect(bad.mock.calls[0][0]).toBeInstanceOf(BadRequestException);
    expect(bad.mock.calls[0][1]).toBe(false);
  });

  it('kiểm tra chữ ký file khớp mimetype', () => {
    const pdf = Buffer.from('%PDF-1.4 ...');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
    const jpg = Buffer.from([0xff, 0xd8, 0xff]);
    const webp = Buffer.from('RIFF0000WEBPVP8 ');
    expect(() =>
      assertInvoiceFile({ buffer: pdf, mimetype: 'application/pdf' }),
    ).not.toThrow();
    expect(() =>
      assertInvoiceFile({ buffer: png, mimetype: 'image/png' }),
    ).not.toThrow();
    expect(() =>
      assertInvoiceFile({ buffer: jpg, mimetype: 'image/jpeg' }),
    ).not.toThrow();
    expect(() =>
      assertInvoiceFile({ buffer: webp, mimetype: 'image/webp' }),
    ).not.toThrow();
  });

  it('từ chối file thiếu, rỗng hoặc giả mạo loại', () => {
    expect(() => assertInvoiceFile(undefined)).toThrow(BadRequestException);
    expect(() =>
      assertInvoiceFile({ buffer: Buffer.alloc(0), mimetype: 'image/png' }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertInvoiceFile({
        buffer: Buffer.from('<html>'),
        mimetype: 'application/pdf',
      }),
    ).toThrow(BadRequestException);
  });
});
