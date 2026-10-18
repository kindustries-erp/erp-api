/**
 * Khóa sắp xếp migration theo thời gian thật.
 *
 * TypeORM lấy timestamp bằng `parseInt(name.substr(-13))`, nên tên kết thúc bằng
 * `YYYYMMDDHHmmss` (14 số) bị cắt sai và luôn đứng trước migration epoch ms (13 số).
 * Hàm này đọc đúng cả hai kiểu để sắp xếp theo ngày thật.
 */

const TIMESTAMP_SUFFIX = /(?<!\d)(\d{14}|\d{13})$/;

/** `YYYYMMDDHHmmss` (UTC) thành ms. Trả về NaN nếu không phải ngày hợp lệ. */
const parseCompactDate = (digits: string): number => {
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const second = Number(digits.slice(12, 14));
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(ms);
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return valid ? ms : NaN;
};

/**
 * Khóa thời gian của tên migration.
 * - Kết thúc bằng 14 số hợp lệ: ms của ngày đó (UTC).
 * - Kết thúc bằng 13 số: chính giá trị epoch ms.
 * - Tên khác: lấy 13 ký tự cuối như TypeORM (để không đổi thứ tự của các migration lạ).
 */
export const migrationChronologicalKey = (name: string): number => {
  const match = TIMESTAMP_SUFFIX.exec(name);
  if (match) {
    const digits = match[1];
    if (digits.length === 14) {
      const ms = parseCompactDate(digits);
      if (!Number.isNaN(ms)) return ms;
    }
    return Number(digits);
  }
  return parseInt(name.substr(-13), 10);
};
