/** Loại chứng từ sở hữu file. Thêm owner mới (vd. Garage PR) chỉ cần thêm giá trị ở đây và đăng ký owner policy. */
export const FileOwnerType = {
  INVOICE: 'INVOICE',
} as const;
export type FileOwnerType = (typeof FileOwnerType)[keyof typeof FileOwnerType];

/** Nhóm tài liệu. Map từ `document_type` của V1 (`HOA_DON`...). */
export const FileCategory = {
  HOA_DON: 'HOA_DON',
  BANG_KE: 'BANG_KE',
  HOP_DONG: 'HOP_DONG',
  KHAC: 'KHAC',
} as const;
export type FileCategory = (typeof FileCategory)[keyof typeof FileCategory];

/** `V2`: do module này upload. `LEGACY`: trỏ lại khóa R2 cũ của V1 (backfill hoặc registrar). Chỉ để truy vết. */
export const FileOrigin = {
  V2: 'V2',
  LEGACY: 'LEGACY',
} as const;
export type FileOrigin = (typeof FileOrigin)[keyof typeof FileOrigin];
