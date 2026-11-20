import { BadRequestException } from '@nestjs/common';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type {
  CaseDashboardDateRange,
  CaseDashboardPeriodRanges,
} from '../services/case-dashboard-kpi-query.service';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parse `YYYY-MM-DD` theo giờ máy chủ (giống V1), trả về đầu ngày. */
export function parseDay(value: string, field: string): Date {
  const d = DAY_PATTERN.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(Number.NaN);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${field} không hợp lệ (YYYY-MM-DD).`);
  }
  return startOfDay(d);
}

/** Khoảng tháng/tuần/ngày quanh một ngày gốc; tuần bắt đầu thứ Hai như V1. */
export function periodRangesFor(base: Date): CaseDashboardPeriodRanges {
  return {
    month: { start: startOfMonth(base), end: endOfMonth(base) },
    week: {
      start: startOfWeek(base, { weekStartsOn: 1 }),
      end: endOfWeek(base, { weekStartsOn: 1 }),
    },
    day: { start: startOfDay(base), end: endOfDay(base) },
  };
}

/**
 * Khoảng ngày `[date_from, date_to]` (bao trọn cả ngày cuối).
 * Thiếu cả hai thì lấy tháng của `now`; thiếu một đầu thì dùng đầu còn lại.
 */
export function resolveDayRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  now: Date,
): CaseDashboardDateRange {
  if (!dateFrom && !dateTo) {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
  const start = parseDay(dateFrom ?? (dateTo as string), 'date_from');
  const end = endOfDay(parseDay(dateTo ?? (dateFrom as string), 'date_to'));
  if (start > end) {
    throw new BadRequestException('date_from phải trước hoặc bằng date_to.');
  }
  return { start, end };
}
