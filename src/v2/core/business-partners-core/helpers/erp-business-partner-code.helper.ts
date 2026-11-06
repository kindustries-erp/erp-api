/**
 * Mã đối tác: tiền tố theo loại (NCC- nhà cung cấp, KH- khách hàng, DT- loại khác) và số thứ tự 3 chữ số.
 * Hàm thuần, không gọi DB. Giữ nguyên quy tắc đánh số của bản V1.
 */

const isVendorType = (partnerType?: string): boolean =>
  !partnerType || partnerType.toUpperCase() === 'VENDOR';

const isCustomerType = (partnerType?: string): boolean =>
  partnerType?.toUpperCase() === 'CUSTOMER';

/** Chuẩn hóa mã nhập vào: bỏ khoảng trắng đầu/cuối và viết hoa. */
export const normalizePartnerCode = (code: string): string =>
  code.trim().toUpperCase();

export const partnerCodePrefix = (partnerType?: string): string =>
  isVendorType(partnerType)
    ? 'NCC-'
    : isCustomerType(partnerType)
      ? 'KH-'
      : 'DT-';

/** Loại đối tác lưu trong DB để đếm số thứ tự: VENDOR/CUSTOMER chuẩn hóa, loại khác giữ nguyên. */
export const storedPartnerType = (partnerType?: string): string => {
  if (isVendorType(partnerType)) return 'VENDOR';
  if (isCustomerType(partnerType)) return 'CUSTOMER';
  return partnerType as string;
};

/** Mã kế tiếp: số lớn nhất ở cuối các mã đã có, cộng 1, đệm 3 chữ số. */
export const nextPartnerCode = (
  existingCodes: string[],
  partnerType?: string,
): string => {
  let maxSeq = 0;
  for (const code of existingCodes) {
    if (!code) continue;
    const match = String(code).match(/(\d+)$/);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  return `${partnerCodePrefix(partnerType)}${String(maxSeq + 1).padStart(3, '0')}`;
};
