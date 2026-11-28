/**
 * Tuổi quá hạn của phiếu dự thu / dự chi: số ngày = hôm nay (giờ VN) − ngày dự thu chi.
 * Dùng chung cho danh sách, tổng, tùy chọn cột, export (v1) và query v2.
 */
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { getGMT7YearMonthDayString } from '@/common/utils/date.util';

export const GARAGE_OVERDUE_BUCKETS = [
  'NOT_DUE',
  'D1_30',
  'D31_90',
  'D90_PLUS',
] as const;
export type GarageOverdueBucket = (typeof GARAGE_OVERDUE_BUCKETS)[number];

/** Khoảng số ngày quá hạn của từng nhóm (gồm hai đầu); bỏ trống là không chặn. */
const BUCKET_DAYS: Record<GarageOverdueBucket, { min?: number; max?: number }> =
  {
    NOT_DUE: { max: 0 },
    D1_30: { min: 1, max: 30 },
    D31_90: { min: 31, max: 90 },
    D90_PLUS: { min: 91 },
  };

const isBucket = (value: string): value is GarageOverdueBucket =>
  (GARAGE_OVERDUE_BUCKETS as readonly string[]).includes(value);

function daysBefore(now: Date, days: number): string {
  const today = getGMT7YearMonthDayString(now);
  const date = new Date(
    Date.UTC(
      Number(today.slice(0, 4)),
      Number(today.slice(4, 6)) - 1,
      Number(today.slice(6, 8)) - days,
    ),
  );
  return date.toISOString().slice(0, 10);
}

/** Đổi nhóm quá hạn thành khoảng ngày dự thu chi (YYYY-MM-DD, gồm hai đầu). */
export function overdueDateRange(
  bucket: GarageOverdueBucket,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const { min, max } = BUCKET_DAYS[bucket];
  return {
    ...(max === undefined ? {} : { from: daysBefore(now, max) }),
    ...(min === undefined ? {} : { to: daysBefore(now, min) }),
  };
}

/**
 * Lọc theo nhóm quá hạn. Luôn giới hạn trong phiếu dự thu / dự chi vì phiếu đã thu chi không có tuổi quá hạn.
 * Giá trị lạ bị bỏ qua. `statusColumn` là `payment_status` ở bảng v1 và `status` ở bảng v2.
 */
export function applyGarageOverdueFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  values: string[],
  options: { alias: string; statusColumn: string; now?: Date },
): void {
  const buckets = values.filter(isBucket);
  if (buckets.length === 0) return;

  const { alias, statusColumn, now = new Date() } = options;
  const params: Record<string, string> = {};
  const ranges = buckets.map((bucket) => {
    const { from, to } = overdueDateRange(bucket, now);
    const parts: string[] = [];
    if (from) {
      params[`overdue_${bucket}_from`] = from;
      parts.push(`${alias}.trans_date >= :overdue_${bucket}_from`);
    }
    if (to) {
      params[`overdue_${bucket}_to`] = to;
      parts.push(`${alias}.trans_date <= :overdue_${bucket}_to`);
    }
    return `(${parts.join(' AND ')})`;
  });

  qb.andWhere(
    `((${alias}.voucher_type = 'RECEIPT' AND ${alias}.${statusColumn} = 'EXPECTED') OR (${alias}.voucher_type = 'PAYMENT' AND ${alias}.${statusColumn} IN ('PENDING', 'APPROVED')))`,
  );
  qb.andWhere(`(${ranges.join(' OR ')})`, params);
}
