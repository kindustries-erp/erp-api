import type {
  DebtAgingBucketDef,
  DebtAgingDistribution,
} from '../contracts/debt-summary.contract';
import { toMoney } from './debt-balance.engine';
import type { MoneyInput } from './debt-balance.engine';

/** Mốc mặc định, khớp `GARAGE_AGING_BUCKET_RANGES` hiện tại: <=30, 31-60, 61-90, >90 ngày. */
export const DEFAULT_AGING_BUCKETS: ReadonlyArray<DebtAgingBucketDef> = [
  { key: '0-30', maxDays: 30 },
  { key: '31-60', maxDays: 60 },
  { key: '61-90', maxDays: 90 },
  { key: '>90', maxDays: null },
];

const MS_PER_DAY = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** Số thứ tự ngày lịch (bỏ giờ). Chuỗi dạng YYYY-MM-DD... lấy đúng phần ngày; Date lấy ngày theo giờ máy chủ. */
function toDayNumber(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const match = DATE_ONLY.exec(value);
    if (match)
      return (
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) /
        MS_PER_DAY
      );
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Ngày lịch theo giờ máy chủ: driver pg đọc cột `timestamp` thành Date theo giờ local, và
  // `CURRENT_DATE` của SQL cũng là ngày local. Dùng getter UTC sẽ lệch một ngày quanh nửa đêm.
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
  );
}

/**
 * Engine thuần tính tuổi nợ. Tương đương `CURRENT_DATE - DATE(ngày mốc)` của SQL hiện tại,
 * nhưng `asOf` được truyền vào nên kiểm thử được và không phụ thuộc đồng hồ máy chủ.
 */
export class DebtAgingEngine {
  /** Số ngày từ ngày mốc đến `asOf`. Null nếu không có ngày mốc hoặc ngày không hợp lệ. */
  static daysOutstanding(
    baseDate: Date | string | null | undefined,
    asOf: Date = new Date(),
  ): number | null {
    const base = toDayNumber(baseDate);
    const now = toDayNumber(asOf);
    return base === null || now === null ? null : Math.round(now - base);
  }

  /** Khóa mốc của một số ngày. Số ngày âm rơi vào mốc đầu, như điều kiện `<= 30` của SQL hiện tại. */
  static bucketOf(
    days: number,
    buckets: ReadonlyArray<DebtAgingBucketDef> = DEFAULT_AGING_BUCKETS,
  ): string {
    const bucket = buckets.find((b) => b.maxDays === null || days <= b.maxDays);
    if (!bucket)
      throw new Error(
        'Danh sách mốc tuổi nợ phải có một mốc cuối không giới hạn (maxDays = null)',
      );
    return bucket.key;
  }

  /** Chia số dư các khoản vào mốc. Khoản không có ngày mốc cộng vào `undated`. */
  static distribute(
    rows: ReadonlyArray<{
      baseDate: Date | string | null;
      balance: MoneyInput;
    }>,
    asOf: Date = new Date(),
    buckets: ReadonlyArray<DebtAgingBucketDef> = DEFAULT_AGING_BUCKETS,
  ): DebtAgingDistribution {
    const cents: Record<string, number> = Object.fromEntries(
      buckets.map((b) => [b.key, 0]),
    );
    let undatedCents = 0;

    for (const row of rows) {
      const amountCents = Math.round(toMoney(row.balance) * 100);
      const days = DebtAgingEngine.daysOutstanding(row.baseDate, asOf);
      if (days === null) undatedCents += amountCents;
      else cents[DebtAgingEngine.bucketOf(days, buckets)] += amountCents;
    }

    return {
      buckets: Object.fromEntries(
        Object.entries(cents).map(([key, value]) => [key, value / 100]),
      ),
      undated: undatedCents / 100,
    };
  }

  /** Số ngày của khoản còn nợ lâu nhất; null nếu không khoản nào còn nợ và có ngày mốc. */
  static oldestDays(
    rows: ReadonlyArray<{
      baseDate: Date | string | null;
      balance: MoneyInput;
    }>,
    asOf: Date = new Date(),
  ): number | null {
    let oldest: number | null = null;
    for (const row of rows) {
      if (toMoney(row.balance) <= 0) continue;
      const days = DebtAgingEngine.daysOutstanding(row.baseDate, asOf);
      if (days !== null && (oldest === null || days > oldest)) oldest = days;
    }
    return oldest;
  }
}
