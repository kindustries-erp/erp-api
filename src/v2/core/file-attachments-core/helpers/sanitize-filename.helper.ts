/* eslint-disable no-control-regex */
const MAX_BASE_LENGTH = 120;
const MAX_EXT_LENGTH = 10;
const FALLBACK_NAME = 'file';

/** Tên upload từ multer đôi khi là latin1 của chuỗi UTF-8; khôi phục nếu đọc ngược được. */
function repairMojibake(name: string): string {
  if (!/[\u00c0-\u00ff]/.test(name) || /[^\u0000-\u00ff]/.test(name)) {
    return name;
  }
  const repaired = Buffer.from(name, 'latin1').toString('utf8');
  return repaired.includes('\ufffd') ? name : repaired;
}

/**
 * Chuẩn hóa tên file để lưu và đặt vào khóa R2: bỏ đường dẫn, ký tự điều khiển,
 * ký tự đặc biệt; giữ chữ có dấu; chỉ giữ MỘT đuôi (ký tự an toàn, tối đa 10).
 */
export function sanitizeFileName(raw: string | null | undefined): string {
  const text = repairMojibake(String(raw ?? ''))
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '');
  const leaf = text.split(/[\\/]/).pop() ?? '';
  const dot = leaf.lastIndexOf('.');
  const hasExt = dot > 0 && dot < leaf.length - 1;
  const rawBase = hasExt ? leaf.slice(0, dot) : leaf;
  const rawExt = hasExt ? leaf.slice(dot + 1) : '';

  const base =
    rawBase
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/_{2,}/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, MAX_BASE_LENGTH) || FALLBACK_NAME;
  const ext = rawExt
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_EXT_LENGTH);
  return ext ? `${base}.${ext}` : base;
}

/** Đuôi file (không dấu chấm, chữ thường) của tên đã hoặc chưa sanitize. */
export function extensionOf(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const dot = safe.lastIndexOf('.');
  return dot > 0 ? safe.slice(dot + 1) : '';
}
