/**
 * uom.helper.ts
 *
 * Helper thuần túy (Pure Helper) chuẩn hóa Đơn vị tính (UOM / ĐVT):
 * - Trim khoảng trắng đầu/cuối và thu gọn khoảng trắng kép
 * - Chuyển toàn bộ ký tự sang IN HOA (UPPERCASE), giữ nguyên dấu tiếng Việt
 * - Trả về null nếu chuỗi rỗng hoặc chỉ toàn khoảng trắng
 */

export function normalizeUom(unit?: string | null): string | null {
  if (!unit) return null;
  const cleaned = unit.trim().replace(/\s+/g, ' ').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}
