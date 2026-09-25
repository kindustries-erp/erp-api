/**
 * Helper ánh xạ Phân loại Hóa đơn (14 Danh mục chuẩn) sang Hệ thống Tài khoản Kế toán
 * theo Thông tư 99/2025/TT-BTC.
 *
 * Nguyên tắc kế toán kép cho Hóa đơn mua vào (direction = 'IN'):
 * - Nợ TK Chi phí / Giá vốn / Hàng hóa / CCDC (1561, 1562, 1563, 152, 153, 632, 6427, 635, 6422, 6428) hoặc TK Tạm T0003 (khi chưa phân loại / AI fallback)
 * - Nợ TK 1331 (Thuế GTGT đầu vào được khấu trừ)
 * - Có TK 331 (Phải trả người bán)
 */

export const CATEGORY_TO_DEBIT_ACCOUNT_MAP: Readonly<Record<string, string>> = {
  VF_PARTS: '1561', // Hàng hóa VinFast chính hãng
  COMMERCIAL_VEHICLES: '1562', // Mua xe thương mại / xe lướt
  OEM_OTHER_PARTS: '1563', // Phụ tùng OEM & Hãng khác
  WORKSHOP_CONSUMABLES: '152', // Nguyên vật liệu tiêu hao (sơn, keo 2K, nhớt...)
  GARAGE_SUBCONTRACT: '632', // Gia công ngoài (sửa pin, phục hồi mâm, đồng sơn)
  GARAGE_TOOLS_EQUIPMENT: '153', // CCDC / Thiết bị xưởng (phân bổ qua 242)
  OFFICE_IT_FACILITIES: '153', // CCDC / CNTT văn phòng (phân bổ qua 242)
  OPEX_LOGISTICS: '6427', // Vận chuyển, Grab Express, 911, Viettel Post
  OPEX_SECURITY_CLEANING: '6427', // Bảo vệ, Vệ sinh, Môi trường
  OPEX_BANK_FEES: '635', // Phí ngân hàng Techcombank, phí POS, lãi vay
  OPEX_ADMIN: '6422', // Hành chính, VPP, Nước uống 19L
  OPEX_LEGAL_CONSULTING: '6427', // Tư vấn pháp lý, kế toán BCTC
  OPEX_IT_SOFTWARE: '6427', // Bản quyền phần mềm KGARA, Cloud, internet
  OPEX_MARKETING: '6428', // Tiếp thị, sự kiện, quà tặng tri ân
};

export const FALLBACK_PURCHASE_DEBIT_ACCOUNT = 'T0003';
export const STANDARD_VAT_DEBIT_ACCOUNT = '1331';
export const STANDARD_AP_CREDIT_ACCOUNT = '331';

export interface InvoiceAccountResolution {
  debitAccountCode: string;
  vatAccountCode: string;
  creditAccountCode: string;
  categoryCode: string | null;
  isFallback: boolean;
}

/**
 * Phân giải các tài khoản kế toán đối ứng cho hóa đơn đầu vào dựa trên mã danh mục.
 * @param categoryCode Mã phân loại danh mục (vd: 'VF_PARTS', 'OPEX_LOGISTICS'...)
 * @returns Cấu trúc tài khoản Nợ/Có chuẩn TT99
 */
export function resolveInvoiceAccountsByCategory(
  categoryCode?: string | null,
): InvoiceAccountResolution {
  const cleanCode = (categoryCode || '').trim();
  const debitAccountCode =
    CATEGORY_TO_DEBIT_ACCOUNT_MAP[cleanCode] || FALLBACK_PURCHASE_DEBIT_ACCOUNT;
  const isFallback = debitAccountCode === FALLBACK_PURCHASE_DEBIT_ACCOUNT;

  return {
    debitAccountCode,
    vatAccountCode: STANDARD_VAT_DEBIT_ACCOUNT,
    creditAccountCode: STANDARD_AP_CREDIT_ACCOUNT,
    categoryCode: cleanCode || null,
    isFallback,
  };
}
