const SEQUENCE_DIGITS = 6;
const MAX_CODE_LENGTH = 128;

/** Chuẩn hóa mã: chữ hoa, bỏ khoảng trắng, chỉ giữ chữ số và `- _ . /`. */
export function normalizeItemCode(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9\-_./]/g, '')
    .slice(0, MAX_CODE_LENGTH);
}

/** Nhóm hàng hợp lệ từ giá trị nhập; không hợp lệ thì dùng nhóm mặc định. */
export function toItemType<T extends string>(
  value: unknown,
  types: readonly T[],
  fallback: T,
): T {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (types as readonly string[]).includes(text) ? (text as T) : fallback;
}

/** Nhóm hàng suy từ tiền tố của mã; mã không có tiền tố chuẩn thì trả `null`. */
export function itemTypeOfCode<T extends string>(
  code: string,
  types: readonly T[],
): T | null {
  const prefix = normalizeItemCode(code).split('-')[0];
  return (types as readonly string[]).includes(prefix) ? (prefix as T) : null;
}

/** Gắn tiền tố nhóm cho mã gốc trên chứng từ; mã đã có tiền tố chuẩn thì giữ nguyên. */
export function withTypePrefix<T extends string>(
  rawCode: string,
  type: T,
  types: readonly T[],
): string {
  const code = normalizeItemCode(rawCode);
  if (!code) return '';
  return itemTypeOfCode(code, types)
    ? code
    : `${type}-${code}`.slice(0, MAX_CODE_LENGTH);
}

/** Các mã có thể đã lưu cho một mã gốc: chính nó và bản có từng tiền tố. */
export function codeCandidates(
  rawCode: string | null | undefined,
  types: readonly string[],
): string[] {
  const code = normalizeItemCode(rawCode);
  if (!code) return [];
  if (itemTypeOfCode(code, types)) return [code];
  return [code, ...types.map((type) => `${type}-${code}`)];
}

export function formatSequenceCode(type: string, sequence: number): string {
  return `${type}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/** Biểu thức regex Postgres khớp mã số thứ tự của một nhóm, vd `^PT-(\d{6})$`. */
export function sequencePattern(type: string): string {
  return `^${type}-(\\d{${SEQUENCE_DIGITS}})$`;
}
