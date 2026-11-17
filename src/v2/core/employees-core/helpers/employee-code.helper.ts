/** Mã nhân viên: tiền tố `NV-` và số thứ tự 3 chữ số. Hàm thuần, không gọi DB. */

export const EMPLOYEE_CODE_PREFIX = 'NV-';

/** Chuẩn hóa mã nhập vào: bỏ khoảng trắng đầu/cuối và viết hoa. */
export const normalizeEmployeeCode = (code: string): string =>
  code.trim().toUpperCase();

/** Mã kế tiếp: số lớn nhất ở cuối các mã đã có (kể cả đã xóa mềm), cộng 1, đệm 3 chữ số. */
export const nextEmployeeCode = (existingCodes: string[]): string => {
  let maxSeq = 0;
  for (const code of existingCodes) {
    const match = String(code ?? '').match(/(\d+)$/);
    if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
  }
  return `${EMPLOYEE_CODE_PREFIX}${String(maxSeq + 1).padStart(3, '0')}`;
};
