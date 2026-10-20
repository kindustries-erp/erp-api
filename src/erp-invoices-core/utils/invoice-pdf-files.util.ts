export interface InvoicePdfAttachmentLike {
  attachment?: {
    fileKey?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
  } | null;
}

export interface InvoicePdfSource {
  pdfFileKey?: string | null;
  pdfFiles?: Array<{ key?: string | null; name?: string | null } | null> | null;
  attachments?: InvoicePdfAttachmentLike[] | null;
}

export interface InvoicePdfFile {
  key: string;
  filename: string;
}

const PDF_MIME = 'application/pdf';

function isPdfAttachment(fileName: string, mimeType: string | null): boolean {
  return mimeType === PDF_MIME || /\.pdf$/i.test(fileName);
}

function ensurePdfName(name: string): string {
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

/**
 * Chọn các file PDF thật của hóa đơn. Không bao giờ trả về zip/xml.
 * Thứ tự: attachment PDF → `pdfFiles` → `pdfFileKey`; khử trùng theo key.
 */
export function resolveInvoicePdfFiles(
  invoice: InvoicePdfSource,
): InvoicePdfFile[] {
  const result: InvoicePdfFile[] = [];
  const seen = new Set<string>();
  const push = (key: string | null | undefined, filename: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({ key, filename: ensurePdfName(filename) });
  };

  for (const link of invoice.attachments ?? []) {
    const file = link?.attachment;
    if (!file?.fileKey) continue;
    const fileName = file.fileName ?? '';
    if (!isPdfAttachment(fileName, file.mimeType ?? null)) continue;
    push(file.fileKey, fileName || 'document.pdf');
  }

  for (const item of invoice.pdfFiles ?? []) {
    if (!item?.key) continue;
    push(item.key, item.name || 'document.pdf');
  }

  push(invoice.pdfFileKey, 'document.pdf');

  return result;
}
