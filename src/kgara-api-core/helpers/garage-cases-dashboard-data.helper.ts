import type { CaseDashboardRow } from './kgara-completed-cases-sheet.builder';

export type BucketUnit = 'day' | 'week' | 'month';

/** Ngày dùng để xếp phiếu vào kỳ trên biểu đồ theo thời gian. */
export type DateBasis = 'completion' | 'received' | 'issued';

export interface TimeSeriesPoint {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface NamedAmount {
  label: string;
  revenue: number;
  profit: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LIMIT = 31;
const WEEK_LIMIT = 120;

const pad = (n: number) => String(n).padStart(2, '0');

/** ≤ 31 ngày → ngày, ≤ 120 ngày → tuần ISO, còn lại → tháng. */
export function chooseBucketUnit(spanDays: number): BucketUnit {
  if (spanDays <= DAY_LIMIT) return 'day';
  if (spanDays <= WEEK_LIMIT) return 'week';
  return 'month';
}

const parseDay = (v?: string): Date | null => {
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Số ngày của khoảng báo cáo: ưu tiên `from`/`to` của người dùng, nếu thiếu thì
 * lấy theo ngày nhỏ nhất/lớn nhất của dữ liệu.
 */
export function spanInDays(
  from: string | undefined,
  to: string | undefined,
  dates: Date[],
): number {
  let start = parseDay(from);
  let end = parseDay(to);
  if (!start || !end) {
    if (dates.length === 0) return 0;
    const times = dates.map((d) => d.getTime());
    start = start ?? new Date(Math.min(...times));
    end = end ?? new Date(Math.max(...times));
  }
  return (
    Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS)) + 1
  );
}

/** Tuần ISO 8601 (thứ Hai là ngày đầu tuần); năm ISO có thể khác năm dương lịch. */
export function isoWeekParts(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  );
  return { year: d.getUTCFullYear(), week };
}

export function bucketOf(
  date: Date,
  unit: BucketUnit,
): { key: string; label: string } {
  if (unit === 'day') {
    const y = date.getFullYear();
    return {
      key: `${y}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      label: `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`,
    };
  }
  if (unit === 'week') {
    const { year, week } = isoWeekParts(date);
    return { key: `${year}-W${pad(week)}`, label: `Tuần ${pad(week)}/${year}` };
  }
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  return { key: `${y}-${m}`, label: `${m}/${y}` };
}

export function pickBasisDate(
  row: CaseDashboardRow,
  basis: DateBasis,
): Date | null {
  if (basis === 'issued') return row.issuedDate;
  if (basis === 'received') return row.receivedDate ?? row.issuedDate;
  return row.completionDate ?? row.receivedDate ?? row.issuedDate;
}

/** Doanh thu / chi phí / lợi nhuận theo kỳ (chỉ các kỳ có dữ liệu), sắp tăng dần. */
export function buildTimeSeries(
  rows: CaseDashboardRow[],
  basis: DateBasis,
  unit: BucketUnit,
): TimeSeriesPoint[] {
  const buckets = new Map<string, TimeSeriesPoint>();
  for (const row of rows) {
    const date = pickBasisDate(row, basis);
    if (!date) continue;
    const { key, label } = bucketOf(date, unit);
    const point = buckets.get(key) ?? {
      key,
      label,
      revenue: 0,
      cost: 0,
      profit: 0,
    };
    point.revenue += row.revenue;
    point.cost += row.cost;
    point.profit += row.profit;
    buckets.set(key, point);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Doanh thu theo phân loại, lớn → nhỏ (bỏ phân loại doanh thu ≤ 0). */
export function classificationBreakdown(
  rows: CaseDashboardRow[],
): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const row of rows) {
    const item = map.get(row.classification) ?? {
      label: row.classification,
      revenue: 0,
      profit: 0,
    };
    item.revenue += row.revenue;
    item.profit += row.profit;
    map.set(row.classification, item);
  }
  return [...map.values()]
    .filter((i) => i.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
}

/** Top N khách hàng theo doanh thu (gộp theo tên khách hàng). */
export function topCustomersByRevenue(
  rows: CaseDashboardRow[],
  limit = 10,
): NamedAmount[] {
  const map = new Map<string, NamedAmount>();
  for (const row of rows) {
    const label = row.customerName || '—';
    const item = map.get(label) ?? { label, revenue: 0, profit: 0 };
    item.revenue += row.revenue;
    item.profit += row.profit;
    map.set(label, item);
  }
  return [...map.values()]
    .filter((i) => i.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}
