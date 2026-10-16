/** Số ngày có phiếu tối đa để vẫn vẽ theo ngày; nhiều hơn thì gộp theo tuần. */
export const MAX_DAILY_BUCKETS = 14;

export interface CashflowBucketInput {
  /** `YYYY-MM-DD`. */
  transDate: string;
  type: 'RECEIPT' | 'PAYMENT';
  amount: number;
}

export interface CashflowBucket {
  /** `dd/MM` (theo ngày) hoặc `Tuần dd/MM` (theo tuần, dd/MM là thứ Hai). */
  label: string;
  thu: number;
  chi: number;
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Thứ Hai của tuần chứa `iso` (`YYYY-MM-DD`), tính theo UTC để không lệch múi giờ. */
export function mondayOf(iso: string): string {
  const date = new Date(
    Date.UTC(
      Number(iso.slice(0, 4)),
      Number(iso.slice(5, 7)) - 1,
      Number(iso.slice(8, 10)),
    ),
  );
  const dow = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (dow - 1));
  return date.toISOString().slice(0, 10);
}

/**
 * Gộp phiếu thu/chi để vẽ chart "Thu vs chi": theo ngày khi có tối đa
 * `MAX_DAILY_BUCKETS` ngày có phiếu, ngược lại gộp theo tuần (thứ Hai - Chủ nhật).
 * Kết quả sắp theo thời gian tăng dần.
 */
export function bucketCashflow(
  vouchers: CashflowBucketInput[],
): CashflowBucket[] {
  const valid = vouchers.filter((v) => /^\d{4}-\d{2}-\d{2}/.test(v.transDate));
  const days = new Set(valid.map((v) => v.transDate.slice(0, 10)));
  const byWeek = days.size > MAX_DAILY_BUCKETS;

  const buckets = new Map<string, { thu: number; chi: number }>();
  for (const v of valid) {
    const day = v.transDate.slice(0, 10);
    const key = byWeek ? mondayOf(day) : day;
    const bucket = buckets.get(key) ?? { thu: 0, chi: 0 };
    if (v.type === 'PAYMENT') bucket.chi += v.amount;
    else bucket.thu += v.amount;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      label: byWeek ? `Tuần ${dayMonth(key)}` : dayMonth(key),
      thu: v.thu,
      chi: v.chi,
    }));
}
