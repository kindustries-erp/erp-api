import { BadRequestException } from '@nestjs/common';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/**
 * Kiểm tra tham số ngày lọc công nợ (`date_from` / `date_to`) trước khi đưa vào SQL.
 * Chấp nhận `YYYY-MM-DD` hoặc ISO không múi giờ (`YYYY-MM-DDTHH:mm[:ss[.sss]]`).
 * Trả về nguyên chuỗi đầu vào (hoặc undefined khi rỗng); sai định dạng hoặc ngày không tồn tại → 400.
 */
export function parseDebtDate(
  value: string | undefined | null,
  name: string,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const m = DATE_ONLY.exec(value) ?? DATE_TIME.exec(value);
  if (!m) {
    throw new BadRequestException(`Tham số ${name} phải có dạng YYYY-MM-DD.`);
  }
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (
    real.getUTCFullYear() !== y ||
    real.getUTCMonth() !== mo - 1 ||
    real.getUTCDate() !== d
  ) {
    throw new BadRequestException(`Tham số ${name} không phải ngày hợp lệ.`);
  }
  return value;
}
