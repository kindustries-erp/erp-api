import { normalizeVietnamese } from '@/v2/core/base-core/helpers/text-normalize.util';

const LABOR_PREFIX = /^cong(\s|$)/;
const LABOR_HOUR = /\bgio cong\b/;

/**
 * Dòng hạng mục là "công" (nhân công) khi ĐVT là công. Chỉ dựa vào ĐVT, không xét Loại DV/PT.
 * ĐVT nhập tay nên nhiều biến thể: `Công`, `công`, `CÔNG`, `cõng`, `cong`, `Cọng`, `Công - 1`,
 * `Công sơn`, `giờ công`, khoảng trắng thừa. Chuẩn hóa bỏ dấu và chữ hoa rồi so khớp.
 * Không nhận `Lần`, `Xe`, `Cái`, `Lượt`, `C`, `Cá`, rỗng.
 */
export function isLaborUnit(unit: string | null | undefined): boolean {
  const n = normalizeVietnamese(unit);
  if (!n) return false;
  return LABOR_PREFIX.test(n) || LABOR_HOUR.test(n);
}
