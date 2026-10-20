export interface InvoiceZipAttachmentLike {
  attachment?: {
    fileKey?: string | null;
    fileName?: string | null;
  } | null;
}

export interface InvoiceZipSource {
  xmlFileKey?: string | null;
  attachments?: Array<InvoiceZipAttachmentLike | null> | null;
}

export interface InvoiceZipFile {
  key: string;
  filename: string;
}

const ZIP_EXT = /\.zip$/i;

/**
 * Chọn các gói ZIP gốc của hóa đơn (gói của nhà cung cấp). Không trả PDF/XML.
 * Thứ tự: zip đính kèm (attachment) → `xml_file_key` nếu là `.zip`; khử trùng theo key.
 */
export function resolveInvoiceZipFiles(
  invoice: InvoiceZipSource,
): InvoiceZipFile[] {
  const result: InvoiceZipFile[] = [];
  const seen = new Set<string>();
  const push = (key: string | null | undefined, filename: string) => {
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({ key, filename });
  };

  for (const link of invoice.attachments ?? []) {
    const file = link?.attachment;
    if (!file?.fileKey) continue;
    const fileName = file.fileName ?? '';
    if (!ZIP_EXT.test(fileName)) continue;
    push(file.fileKey, fileName);
  }

  const xmlKey = invoice.xmlFileKey;
  if (xmlKey && ZIP_EXT.test(xmlKey)) {
    push(xmlKey, xmlKey.split('/').pop() || 'package.zip');
  }

  return result;
}
