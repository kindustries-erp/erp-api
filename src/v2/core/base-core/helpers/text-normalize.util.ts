const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Chuẩn hóa chữ tiếng Việt để so khớp: bỏ dấu, chữ thường, bỏ ký tự đặc biệt, gộp khoảng trắng.
 * "Lọc  dầu (Ô-tô) Đ1" -> "loc dau o to d1"
 */
export function normalizeVietnamese(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
