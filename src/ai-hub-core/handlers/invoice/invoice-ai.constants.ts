export const VINFAST_TAX_CODES: readonly string[] = [
  '0108926276', // CÔNG TY TNHH KINH DOANH THƯƠNG MẠI VÀ DỊCH VỤ VINFAST
  '0202357718', // CÔNG TY CỔ PHẦN VINFAST VIỆT NAM
];

/** 14 mã danh mục chuẩn (TT 99/2025/TT-BTC) mà AI được phép trả về. */
export const INVOICE_CATEGORY_CODES: readonly string[] = [
  'VF_PARTS',
  'COMMERCIAL_VEHICLES',
  'OEM_OTHER_PARTS',
  'WORKSHOP_CONSUMABLES',
  'GARAGE_SUBCONTRACT',
  'GARAGE_TOOLS_EQUIPMENT',
  'OFFICE_IT_FACILITIES',
  'OPEX_LOGISTICS',
  'OPEX_SECURITY_CLEANING',
  'OPEX_BANK_FEES',
  'OPEX_ADMIN',
  'OPEX_LEGAL_CONSULTING',
  'OPEX_IT_SOFTWARE',
  'OPEX_MARKETING',
];

/** Ngưỡng confidence tối thiểu để chấp nhận kết quả phân loại của AI. */
export const MIN_CLASSIFY_CONFIDENCE = 0.7;

export const LINE_ITEM_TYPES = [
  'PARTS',
  'SERVICE',
  'MATERIAL',
  'DISCOUNT',
  'OTHER',
] as const;
