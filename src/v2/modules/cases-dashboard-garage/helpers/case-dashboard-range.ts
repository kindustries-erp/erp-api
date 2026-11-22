import { BadRequestException } from '@nestjs/common';
import {
  fromVnWall,
  toVnWall,
  vnDayStart,
} from '@/v2/core/base-core/helpers/vn-time.util';
import type {
  CaseDashboardDateRange,
  CaseDashboardPeriodRanges,
} from '../services/case-dashboard-kpi-query.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse `YYYY-MM-DD` theo ngày Việt Nam, trả về instant đầu ngày VN (không phụ thuộc TZ máy chủ). */
export function parseDay(value: string, field: string): Date {
  const d = vnDayStart(value);
  if (!d) {
    throw new BadRequestException(`${field} không hợp lệ (YYYY-MM-DD).`);
  }
  return d;
}

/** Đầu ngày VN chứa `instant`. */
function vnStartOfDay(instant: Date): Date {
  const w = toVnWall(instant);
  return fromVnWall(
    new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate())),
  );
}

const vnEndOfDay = (instant: Date): Date =>
  new Date(vnStartOfDay(instant).getTime() + DAY_MS - 1);

function vnMonthRange(instant: Date): CaseDashboardDateRange {
  const w = toVnWall(instant);
  const y = w.getUTCFullYear();
  const m = w.getUTCMonth();
  return {
    start: fromVnWall(new Date(Date.UTC(y, m, 1))),
    end: new Date(fromVnWall(new Date(Date.UTC(y, m + 1, 1))).getTime() - 1),
  };
}

/** Tuần bắt đầu thứ Hai (như V1), tính theo lịch VN. */
function vnWeekRange(instant: Date): CaseDashboardDateRange {
  const dayStart = vnStartOfDay(instant);
  const dow = toVnWall(instant).getUTCDay(); // 0 = Chủ nhật
  const start = new Date(dayStart.getTime() - ((dow + 6) % 7) * DAY_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS - 1) };
}

/** Khoảng tháng/tuần/ngày quanh một ngày gốc, theo lịch Việt Nam. */
export function periodRangesFor(base: Date): CaseDashboardPeriodRanges {
  return {
    month: vnMonthRange(base),
    week: vnWeekRange(base),
    day: { start: vnStartOfDay(base), end: vnEndOfDay(base) },
  };
}

/**
 * Khoảng ngày `[date_from, date_to]` (bao trọn cả ngày cuối), theo ngày VN.
 * Thiếu cả hai thì lấy tháng của `now`; thiếu một đầu thì dùng đầu còn lại.
 */
export function resolveDayRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  now: Date,
): CaseDashboardDateRange {
  if (!dateFrom && !dateTo) return vnMonthRange(now);
  const start = parseDay(dateFrom ?? (dateTo as string), 'date_from');
  const end = vnEndOfDay(parseDay(dateTo ?? (dateFrom as string), 'date_to'));
  if (start > end) {
    throw new BadRequestException('date_from phải trước hoặc bằng date_to.');
  }
  return { start, end };
}
