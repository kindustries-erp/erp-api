import {
  codeCandidates as coreCodeCandidates,
  itemTypeOfCode as coreItemTypeOfCode,
  toItemType,
  withTypePrefix as coreWithTypePrefix,
} from '@/v2/core/items-core';

export {
  formatSequenceCode,
  normalizeItemCode,
  sequencePattern,
} from '@/v2/core/items-core';

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

/** Cấu hình nhóm hàng truyền cho lõi `items-core`. */
export const GARAGE_ITEM_KIT = {
  types: GARAGE_ITEM_TYPES,
  defaultType: DEFAULT_GARAGE_ITEM_TYPE,
};

export function toGarageItemType(value: unknown): GarageItemType {
  return toItemType(value, GARAGE_ITEM_TYPES, DEFAULT_GARAGE_ITEM_TYPE);
}

/** Nhóm hàng suy từ tiền tố của mã; mã không có tiền tố chuẩn thì trả `null`. */
export function itemTypeOfCode(code: string): GarageItemType | null {
  return coreItemTypeOfCode(code, GARAGE_ITEM_TYPES);
}

/** Gắn tiền tố nhóm cho mã gốc trên chứng từ; mã đã có tiền tố chuẩn thì giữ nguyên. */
export function withTypePrefix(rawCode: string, type: GarageItemType): string {
  return coreWithTypePrefix(rawCode, type, GARAGE_ITEM_TYPES);
}

/** Các mã có thể đã lưu cho một mã gốc: chính nó và bản có từng tiền tố. */
export function codeCandidates(rawCode: string | null | undefined): string[] {
  return coreCodeCandidates(rawCode, GARAGE_ITEM_TYPES);
}
