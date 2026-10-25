import AdmZip from 'adm-zip';

/**
 * Đọc nội dung XML từ buffer tệp hóa đơn (ZIP chứa .xml hoặc XML thuần).
 * Trả chuỗi rỗng nếu không tìm thấy XML.
 */
export function readXmlFromBuffer(fileBuffer: Buffer, fileKey: string): string {
  const isZip =
    fileKey.toLowerCase().endsWith('.zip') ||
    (fileBuffer.length >= 4 &&
      fileBuffer[0] === 0x50 &&
      fileBuffer[1] === 0x4b);

  if (!isZip) return fileBuffer.toString('utf-8');

  const xmlEntry = new AdmZip(fileBuffer)
    .getEntries()
    .find((e) => e.entryName.toLowerCase().endsWith('.xml'));
  return xmlEntry ? xmlEntry.getData().toString('utf-8') : '';
}
