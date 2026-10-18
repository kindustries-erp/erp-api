/** Đơn vị gom mốc thời gian của chart trong báo cáo kỳ. */
export type BucketUnit = 'day' | 'week' | 'month';

/** Kỳ dài hơn số ngày này (gồm cả hai đầu) thì gom theo tháng. */
export const BUCKET_MONTH_ABOVE_DAYS = 60;
/**
 * Kỳ dài hơn số ngày này thì gom theo tuần. 27 (không phải 30) để tháng trọn
 * 28-31 ngày luôn ra theo tuần, còn tuần trọn 7 ngày ra theo ngày.
 */
export const BUCKET_WEEK_ABOVE_DAYS = 27;
/** Chặn trục quá dài khi kỳ nhập sai (vd năm 1900). */
const MAX_BUCKETS = 400;

export interface BucketAxisPoint {
  /** `YYYY-MM-DD` của ngày đầu mốc (ngày, thứ Hai, mùng 1). */
  key: string;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

const toUtcMs = (iso: string): number | null => {
  const m = ISO_DAY.exec(iso);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Thứ Hai của tuần chứa `iso` (`YYYY-MM-DD`), tính theo UTC để không lệch múi giờ. */
export function mondayOf(iso: string): string {
  const ms = toUtcMs(iso);
  if (ms === null) return iso;
  const dow = new Date(ms).getUTCDay() || 7;
  return toIso(ms - (dow - 1) * DAY_MS);
}

/** Số ngày của kỳ, gồm cả ngày đầu và ngày cuối; thiếu hoặc sai định dạng thì `null`. */
export function periodDayCount(from?: string, to?: string): number | null {
  const start = from ? toUtcMs(from) : null;
  const end = to ? toUtcMs(to) : null;
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / DAY_MS) + 1;
}

/**
 * Chọn đơn vị gom theo độ dài kỳ: trên 60 ngày theo tháng, trên 27 ngày theo tuần,
 * còn lại theo ngày. Kỳ thiếu ngày thì gom theo tháng.
 */
export function resolveBucketUnit(from?: string, to?: string): BucketUnit {
  const days = periodDayCount(from, to);
  if (days === null || days > BUCKET_MONTH_ABOVE_DAYS) return 'month';
  return days > BUCKET_WEEK_ABOVE_DAYS ? 'week' : 'day';
}

/** Khóa mốc chứa ngày `iso` theo đơn vị gom. */
export function bucketKeyOf(iso: string, unit: BucketUnit): string {
  const day = iso.slice(0, 10);
  if (unit === 'week') return mondayOf(day);
  if (unit === 'month') return `${day.slice(0, 7)}-01`;
  return day;
}

/** Nhãn trục: `dd/MM`, `Tuần dd/MM` (thứ Hai) hoặc `MM/yyyy`. */
export function bucketLabel(key: string, unit: BucketUnit): string {
  const dayMonth = `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  if (unit === 'month') return `${key.slice(5, 7)}/${key.slice(0, 4)}`;
  return unit === 'week' ? `Tuần ${dayMonth}` : dayMonth;
}

const nextKey = (key: string, unit: BucketUnit): string => {
  const ms = toUtcMs(key) as number;
  if (unit === 'day') return toIso(ms + DAY_MS);
  if (unit === 'week') return toIso(ms + 7 * DAY_MS);
  const d = new Date(ms);
  return toIso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
};

/** Trục liên tục từ mốc chứa `from` đến mốc chứa `to` (kỳ sai thì trục rỗng). */
export function buildBucketAxis(
  from: string | undefined,
  to: string | undefined,
  unit: BucketUnit,
): BucketAxisPoint[] {
  if (periodDayCount(from, to) === null) return [];
  const last = bucketKeyOf(to as string, unit);
  const axis: BucketAxisPoint[] = [];
  for (
    let key = bucketKeyOf(from as string, unit);
    key <= last && axis.length < MAX_BUCKETS;
    key = nextKey(key, unit)
  ) {
    axis.push({ key, label: bucketLabel(key, unit) });
  }
  return axis;
}

/**
 * Cộng các dòng theo ngày vào trục mốc; mốc không có dữ liệu được điền 0 và dòng
 * nằm ngoài trục bị bỏ qua.
 */
export function aggregateByBucket<K extends string>(
  axis: BucketAxisPoint[],
  unit: BucketUnit,
  items: Array<{ date: string } & Record<K, number>>,
  fields: readonly K[],
): Array<BucketAxisPoint & Record<K, number>> {
  const rows = new Map<string, Record<string, string | number>>(
    axis.map((point) => [
      point.key,
      { ...point, ...Object.fromEntries(fields.map((f) => [f, 0])) },
    ]),
  );
  for (const item of items) {
    if (!ISO_DAY.test(item.date)) continue;
    const row = rows.get(bucketKeyOf(item.date, unit));
    if (!row) continue;
    for (const field of fields) {
      row[field] = (row[field] as number) + (Number(item[field]) || 0);
    }
  }
  return [...rows.values()] as unknown as Array<
    BucketAxisPoint & Record<K, number>
  >;
}
