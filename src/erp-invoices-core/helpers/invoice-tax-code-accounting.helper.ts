/**
 * Danh sách Mã số thuế người bán hạch toán vào TK 642 (Chi phí QLDN).
 */
export const TAX_CODES_642: readonly string[] = [
  '0100686209-002',
  '0312650437',
  '0318880490',
  '0104093672',
  '0318115309',
  '0317121966',
];

/**
 * Danh sách Mã số thuế quét phụ tùng VinFast và các đối tác linh kiện chỉ định (hạch toán TK 632).
 */
export const TAX_CODES_632_EXPLICIT: readonly string[] = [
  '0108926276', // VinFast
  '0318334886', // VinFast
  '0202357718', // VinFast
  '3703030236',
  '0304980826',
  '0313189917',
  '0315735600',
];

/**
 * Chuẩn hóa mã số thuế (loại bỏ khoảng trắng).
 */
export function normalizeTaxCode(taxCode?: string | null): string {
  if (!taxCode) return '';
  return String(taxCode).replace(/\s+/g, '').trim();
}

/**
 * Phân loại tài khoản Nợ cho Hóa đơn mua vào (direction = IN).
 * - Nếu thuộc TAX_CODES_642 -> trả về '642'.
 * - Còn lại (bao gồm VinFast, các mã 632 chỉ định và tất cả mã khác) -> trả về '632'.
 */
export function resolvePurchaseDebitAccountCode(
  sellerTaxCode?: string | null,
): string {
  const norm = normalizeTaxCode(sellerTaxCode);
  if (!norm) return '632';

  const is642 = TAX_CODES_642.some((tc) => normalizeTaxCode(tc) === norm);
  if (is642) {
    return '642';
  }

  return '632';
}
