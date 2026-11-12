/** Nhóm hàng và tiền tố mã của garage. Giá trị nhóm cũng là tiền tố. */
export const GARAGE_ITEM_TYPES = [
  'VF', // phụ tùng VinFast
  'PT', // phụ tùng khác
  'VT', // vật tư tiêu hao
  'DV', // dịch vụ, thuê ngoài
  'CK', // chiết khấu
  'CCDC', // công cụ dụng cụ
  'HC', // hành chính, văn phòng phẩm
] as const;
export type GarageItemType = (typeof GARAGE_ITEM_TYPES)[number];

export const DEFAULT_GARAGE_ITEM_TYPE: GarageItemType = 'PT';
const SEQUENCE_DIGITS = 6;
const MAX_CODE_LENGTH = 128;

export function toGarageItemType(value: unknown): GarageItemType {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (GARAGE_ITEM_TYPES as readonly string[]).includes(text)
    ? (text as GarageItemType)
    : DEFAULT_GARAGE_ITEM_TYPE;
}

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

/** Nhóm hàng suy từ tiền tố của mã; mã không có tiền tố chuẩn thì trả `null`. */
export function itemTypeOfCode(code: string): GarageItemType | null {
  const prefix = normalizeItemCode(code).split('-')[0];
  return (GARAGE_ITEM_TYPES as readonly string[]).includes(prefix)
    ? (prefix as GarageItemType)
    : null;
}

/** Gắn tiền tố nhóm cho mã gốc trên chứng từ; mã đã có tiền tố chuẩn thì giữ nguyên. */
export function withTypePrefix(rawCode: string, type: GarageItemType): string {
  const code = normalizeItemCode(rawCode);
  if (!code) return '';
  return itemTypeOfCode(code)
    ? code
    : `${type}-${code}`.slice(0, MAX_CODE_LENGTH);
}

/** Các mã có thể đã lưu cho một mã gốc: chính nó và bản có từng tiền tố. */
export function codeCandidates(rawCode: string | null | undefined): string[] {
  const code = normalizeItemCode(rawCode);
  if (!code) return [];
  if (itemTypeOfCode(code)) return [code];
  return [code, ...GARAGE_ITEM_TYPES.map((type) => `${type}-${code}`)];
}

export function formatSequenceCode(type: GarageItemType, sequence: number) {
  return `${type}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/** Biểu thức regex Postgres khớp mã số thứ tự của một nhóm, vd `^PT-(\d{6})$`. */
export function sequencePattern(type: GarageItemType): string {
  return `^${type}-(\\d{${SEQUENCE_DIGITS}})$`;
}
