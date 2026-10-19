import AdmZip from 'adm-zip';

export interface ExtractedXmlFile {
  name: string;
  buffer: Buffer;
}

/**
 * Bóc các file `.xml` từ gói zip của nhà cung cấp, chỉ trong bộ nhớ.
 * Trả về mảng rỗng nếu buffer không phải zip hoặc zip không chứa XML.
 */
export function extractXmlFromZip(buffer: Buffer): ExtractedXmlFile[] {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return [];
  }

  return zip
    .getEntries()
    .filter(
      (entry) =>
        !entry.isDirectory &&
        !entry.entryName.startsWith('__MACOSX/') &&
        /\.xml$/i.test(entry.entryName),
    )
    .map((entry) => ({
      name: entry.entryName.split('/').pop() || 'invoice.xml',
      buffer: entry.getData(),
    }));
}
