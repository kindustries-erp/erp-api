/**
 * Chuẩn hóa biển số xe: MỘT quy tắc duy nhất cho toàn bộ API (so khớp, gom xe, tìm kiếm).
 *
 * Quy tắc: bỏ dấu tiếng Việt, `Đ`/`đ` → `D`, viết hoa, chỉ giữ `A-Z` và `0-9`
 * (loại `-`, `.`, khoảng trắng và mọi ký tự đặc biệt).
 * `51a-123.45` → `51A12345`; `29-MĐ1 123.45` → `29MD112345`; `null` / `---` → `''`.
 *
 * Giá trị hiển thị vẫn là chuỗi gốc người dùng nhập; hàm này chỉ dùng để so khớp.
 */

/** Chuẩn hóa một biển số. Rỗng nếu không còn ký tự hợp lệ. */
export function normalizePlate(plate?: string | null): string {
  if (!plate) return '';
  return plate
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Chữ cái có dấu cần quy về chữ Latin gốc: tiếng Việt cộng mọi chữ La-tinh có dấu trong
 * Latin-1 Supplement (U+00C0..U+00FF), Latin Extended-A (U+0100..U+017F) và Latin Extended
 * Additional (U+1E00..U+1EFF). Chỉ lấy chữ mà `normalizePlate` cho đúng một ký tự `A-Z`/`0-9`
 * (TRANSLATE ánh xạ 1:1); chữ không có dạng gốc (`Æ`, `Ø`, `ß`) bị loại ở cả TS lẫn SQL.
 * Sinh từ chính `normalizePlate` nên SQL và TS không thể lệch nhau.
 */
const ACCENTED_LETTERS = (() => {
  const out = new Set<string>();
  const ranges: Array<[number, number]> = [
    [0x00c0, 0x00ff],
    [0x0100, 0x017f],
    [0x1e00, 0x1eff],
  ];
  for (const [from, to] of ranges) {
    for (let code = from; code <= to; code++) {
      const ch = String.fromCharCode(code);
      if (/^[A-Z0-9]$/.test(normalizePlate(ch)) && ch !== normalizePlate(ch)) {
        out.add(ch);
      }
    }
  }
  return [...out].join('');
})();

/** Đối ứng chữ Latin gốc (hoa) cho từng chữ trong `ACCENTED_LETTERS`, cùng thứ tự. */
const ACCENTED_BASE = [...ACCENTED_LETTERS]
  .map((ch) => normalizePlate(ch))
  .join('');

const SQL_IDENT = '(?:[A-Za-z_][A-Za-z0-9_]*|"[A-Za-z_][A-Za-z0-9_]*")';
const SQL_COLUMN = new RegExp(`^${SQL_IDENT}(?:\\.${SQL_IDENT})?$`);

/**
 * Biểu thức SQL chuẩn hóa cột biển số, cùng quy tắc với `normalizePlate`:
 * `REGEXP_REPLACE(UPPER(TRANSLATE(col, <chữ có dấu>, <chữ gốc>)), '[^A-Z0-9]', '', 'g')`.
 * Mỗi cột phải là định danh an toàn (`bien_so_xe`, `c.license_plate`, hoặc đường dẫn thuộc tính
 * TypeORM `v.licensePlate`, hoặc có nháy kép như `"case"."bien_so_xe"`), không nhận chuỗi người dùng. Truyền nhiều cột thì lấy cột đầu có giá trị
 * (`COALESCE(c1, c2, '')`).
 */
export function normalizedPlateSql(...columns: string[]): string {
  if (columns.length === 0) {
    throw new Error('normalizedPlateSql: cần ít nhất một cột');
  }
  for (const col of columns) {
    if (!SQL_COLUMN.test(col)) {
      throw new Error(`normalizedPlateSql: cột không hợp lệ: ${col}`);
    }
  }
  const column =
    columns.length === 1 ? columns[0] : `COALESCE(${columns.join(', ')}, '')`;
  // TRANSLATE ánh xạ theo vị trí; chữ thường cũng quy về chữ hoa gốc.
  const from = ACCENTED_LETTERS;
  const to = ACCENTED_BASE;
  return `REGEXP_REPLACE(UPPER(TRANSLATE(${column}, '${from}', '${to}')), '[^A-Z0-9]', '', 'g')`;
}
