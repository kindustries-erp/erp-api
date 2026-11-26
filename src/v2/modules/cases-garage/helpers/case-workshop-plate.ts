/** Biển số chuẩn hóa để so khớp: chữ hoa, bỏ ký tự ngoài chữ và số (`51G-123.45` → `51G12345`). */
export function normalizePlate(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Biểu thức SQL tương ứng `normalizePlate` trên cột `license_plate` của alias `c`. */
export const PLATE_SQL =
  "upper(regexp_replace(coalesce(c.license_plate, ''), '[^A-Za-z0-9]', '', 'g'))";

/** Thoát ký tự đặc biệt của LIKE/ILIKE (`%`, `_`, `\\`) để tìm theo chữ người dùng gõ. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
