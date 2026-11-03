/**
 * Chuẩn hóa số hóa đơn để tìm kiếm: bỏ số 0 đứng đầu ở cụm số cuối cùng.
 * Ví dụ: `AB-00045` → `AB-45`. Trả về null nếu rỗng.
 * Copy từ quy tắc v1 (`erp-invoices-core/utils/normalize-invoice-no.ts`) để v2 không phụ thuộc v1.
 */
export function normalizeInvoiceNo(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  return raw.trim().replace(/(^|[^0-9])0+([0-9]+)([^0-9]*)$/, '$1$2$3');
}
