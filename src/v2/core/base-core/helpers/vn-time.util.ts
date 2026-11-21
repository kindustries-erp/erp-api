/**
 * Mốc thời gian theo giờ Việt Nam (UTC+7, không có DST) độc lập với múi giờ tiến trình.
 * Dùng cho lọc/gom ngày trên cột `timestamptz`, để kết quả không đổi khi máy chủ chạy UTC.
 */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** SQL: `YYYY-MM-DD` của một biểu thức `timestamptz` theo ngày VN. */
export const vnDateSql = (expr: string): string =>
  `TO_CHAR((${expr}) AT TIME ZONE '${VN_TIME_ZONE}', 'YYYY-MM-DD')`;

/** Instant đầu ngày VN của `YYYY-MM-DD`; `null` nếu không đúng định dạng/ngày. */
export function vnDayStart(day: string): Date | null {
  const m = DAY_ONLY.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const ms = Date.UTC(y, mo, d) - VN_UTC_OFFSET_MS;
  const date = new Date(ms);
  // Loại ngày tràn (2026-02-31): kiểm lại bằng giờ tường VN.
  const wall = new Date(ms + VN_UTC_OFFSET_MS);
  return wall.getUTCFullYear() === y &&
    wall.getUTCMonth() === mo &&
    wall.getUTCDate() === d
    ? date
    : null;
}

/** Instant cuối ngày VN (23:59:59.999) của `YYYY-MM-DD`. */
export function vnDayEnd(day: string): Date | null {
  const start = vnDayStart(day);
  return start ? new Date(start.getTime() + DAY_MS - 1) : null;
}

/**
 * Cận lọc ngày cho truy vấn: `YYYY-MM-DD` thành instant đầu/cuối ngày VN;
 * chuỗi ISO có giờ giữ nguyên (đã là instant tuyệt đối).
 */
export function vnDayBound(
  value: string,
  edge: 'start' | 'end',
): Date | string {
  const bound = edge === 'start' ? vnDayStart(value) : vnDayEnd(value);
  return bound ?? value;
}

/** Giờ tường VN của một instant, đặt vào các getter UTC (dùng để tính đầu ngày/tuần/tháng VN). */
export const toVnWall = (instant: Date): Date =>
  new Date(instant.getTime() + VN_UTC_OFFSET_MS);

/** Ngược lại: giờ tường VN (getter UTC) thành instant. */
export const fromVnWall = (wall: Date): Date =>
  new Date(wall.getTime() - VN_UTC_OFFSET_MS);
