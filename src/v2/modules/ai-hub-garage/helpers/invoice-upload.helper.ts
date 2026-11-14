import { BadRequestException } from '@nestjs/common';

export const INVOICE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const INVOICE_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** `fileFilter` của multer: chỉ nhận ảnh JPG/PNG/WEBP và PDF. */
export function invoiceUploadFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, accept: boolean) => void,
) {
  const accepted = (INVOICE_UPLOAD_MIME_TYPES as readonly string[]).includes(
    file.mimetype,
  );
  callback(
    accepted
      ? null
      : new BadRequestException('Chỉ nhận ảnh JPG, PNG, WEBP hoặc file PDF'),
    accepted,
  );
}

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  'image/png': (b) =>
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  'image/webp': (b) =>
    b.subarray(0, 4).toString('ascii') === 'RIFF' &&
    b.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString('ascii') === '%PDF-',
};

/** Kiểm tra nội dung file khớp với loại đã khai báo (không tin riêng mimetype do client gửi). */
export function assertInvoiceFile(file?: {
  buffer: Buffer;
  mimetype: string;
}): void {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Thiếu file hóa đơn (field file)');
  }
  const matches = SIGNATURES[file.mimetype];
  if (!matches || !matches(file.buffer)) {
    throw new BadRequestException(
      'File không đúng định dạng ảnh JPG, PNG, WEBP hoặc PDF',
    );
  }
}
