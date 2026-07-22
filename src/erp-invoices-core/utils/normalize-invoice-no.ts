export function normalizeInvoiceNo(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  // Xóa các số 0 dẫn đầu ở phần số cuối cùng của chuỗi
  return raw.trim().replace(/([^0-9]*)0+([0-9]+)/, '$1$2');
}
