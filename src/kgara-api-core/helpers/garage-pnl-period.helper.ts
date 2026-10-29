import {
  reportMonthOf,
  type PnlLineItem,
  type PnlMonthRef,
  type PnlMonthRow,
  type PnlRevenueSegment,
} from './garage-pnl-month.helper';

const RATE_KEY = 'RATE_LAI_GOP_KY_GUI';
const MAX_PERIOD_MONTHS = 12;

const ym = (ref: PnlMonthRef) => ref.year * 12 + (ref.month - 1);
const fromIndex = (index: number): PnlMonthRef => ({
  year: Math.floor(index / 12),
  month: (index % 12) + 1,
});

/** `YYYY-MM` đầu của chuỗi `YYYY-MM-DD`; không khớp thì `undefined`. */
const parseYearMonth = (day?: string): PnlMonthRef | undefined => {
  const match = /^(\d{4})-(\d{2})/.exec(day ?? '');
  if (!match) return undefined;
  const month = Number(match[2]);
  return month >= 1 && month <= 12
    ? { year: Number(match[1]), month }
    : undefined;
};

export interface PnlPeriod {
  /** Số tháng của một kỳ báo cáo (1 = tháng, 3 = quý trọn). */
  size: number;
  /** Tháng cuối của kỳ báo cáo. */
  end: PnlMonthRef;
}

/**
 * Kỳ báo cáo lợi nhuận: từ tháng của `from` đến tháng của `to`. Kỳ trong một tháng, hoặc không
 * đọc được (thiếu hoặc vượt 12 tháng) thì dùng tháng báo cáo như cũ.
 */
export function resolvePnlPeriod(
  from: string | undefined,
  to: string | undefined,
  today: Date = new Date(),
): PnlPeriod {
  const start = parseYearMonth(from);
  const end = parseYearMonth(to);
  if (!start || !end) return { size: 1, end: reportMonthOf(to, today) };
  const size = ym(end) - ym(start) + 1;
  if (size < 1 || size > MAX_PERIOD_MONTHS) {
    return { size: 1, end: reportMonthOf(to, today) };
  }
  return { size, end };
}

/** Số kỳ hiển thị trên chart xu hướng: 12 với kỳ tháng, ít nhất 2 với kỳ dài hơn. */
export function periodCount(size: number): number {
  return size === 1 ? 12 : Math.max(2, Math.floor(12 / size));
}

/** Số tháng cần tải để có đủ `count` kỳ liên tiếp, kết thúc ở tháng cuối kỳ. */
export function periodWindowSize(size: number): number {
  return periodCount(size) * size;
}

/** Nhãn kỳ: "Tháng 10/2026", "Quý 3/2026", "Kỳ 08–10/2026" hoặc "Kỳ 08/2025–02/2026". */
export function pnlPeriodLabel(size: number, end: PnlMonthRef): string {
  const tag = (m: number) => String(m).padStart(2, '0');
  if (size === 1) return `Tháng ${tag(end.month)}/${end.year}`;
  const start = fromIndex(ym(end) - (size - 1));
  if (size === 3 && end.month % 3 === 0) {
    return `Quý ${end.month / 3}/${end.year}`;
  }
  if (start.year === end.year) {
    return `Kỳ ${tag(start.month)}–${tag(end.month)}/${end.year}`;
  }
  return `Kỳ ${tag(start.month)}/${start.year}–${tag(end.month)}/${end.year}`;
}

/** Cộng các dòng cùng khóa (khóa + ghi chú), giữ thứ tự xuất hiện. */
function mergeItems(lists: PnlLineItem[][]): PnlLineItem[] {
  const merged = new Map<string, PnlLineItem>();
  for (const item of lists.flat()) {
    const key = `${item.categoryKey}|${item.note ?? ''}`;
    const prev = merged.get(key);
    merged.set(
      key,
      prev ? { ...prev, amount: prev.amount + item.amount } : { ...item },
    );
  }
  return [...merged.values()];
}

/** Tỷ lệ lãi gộp ký gửi (%) của kỳ: bình quân theo lợi nhuận gộp của từng tháng. */
function mergeRate(rows: PnlMonthRow[]): number {
  const weight = rows.reduce((acc, r) => acc + Math.max(0, r.grossProfit), 0);
  if (weight > 0) {
    return (
      rows.reduce((acc, r) => {
        const rate =
          r.commissionItems.find((i) => i.categoryKey === RATE_KEY)?.amount ??
          0;
        return acc + rate * Math.max(0, r.grossProfit);
      }, 0) / weight
    );
  }
  const rates = rows.map(
    (r) =>
      r.commissionItems.find((i) => i.categoryKey === RATE_KEY)?.amount ?? 0,
  );
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
}

/** Cộng gộp các tháng của một kỳ thành một dòng P&L (số tiền cộng thẳng, tỷ lệ tính lại). */
export function mergePnlMonths(rows: PnlMonthRow[]): PnlMonthRow {
  const last = rows[rows.length - 1];
  const first = rows[0];
  const sum = (pick: (r: PnlMonthRow) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);
  const segments = new Map<string, PnlRevenueSegment>();
  for (const r of rows) {
    for (const s of r.revenueSegments) {
      const prev = segments.get(s.key);
      segments.set(
        s.key,
        prev
          ? {
              ...prev,
              caseCount: prev.caseCount + s.caseCount,
              revenue: prev.revenue + s.revenue,
              cogs: prev.cogs + s.cogs,
            }
          : { ...s },
      );
    }
  }
  const revenue = sum((r) => r.revenue);
  const grossProfit = sum((r) => r.grossProfit);
  const commissionItems = mergeItems(
    rows.map((r) =>
      r.commissionItems.filter((i) => i.categoryKey !== RATE_KEY),
    ),
  );
  const rate = mergeRate(rows);
  return {
    year: last.year,
    month: last.month,
    periodStart: { year: first.year, month: first.month },
    periodMonths: rows.length,
    revenue,
    cogs: sum((r) => r.cogs),
    cogsDirect: sum((r) => r.cogsDirect),
    cogsAdjustmentItems: mergeItems(rows.map((r) => r.cogsAdjustmentItems)),
    revenueSegments: [...segments.values()],
    grossProfit,
    grossMarginRate: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    opexTotal: sum((r) => r.opexTotal),
    opexItems: mergeItems(rows.map((r) => r.opexItems)),
    financialTotal: sum((r) => r.financialTotal || 0),
    financialItems: mergeItems(rows.map((r) => r.financialItems || [])),
    netBeforeCommission: sum((r) => r.netBeforeCommission),
    hhbhTotal: sum((r) => r.hhbhTotal),
    commissionTotal: sum((r) => r.commissionTotal),
    commissionItems:
      rate > 0 ||
      rows.some((r) =>
        r.commissionItems.some((i) => i.categoryKey === RATE_KEY),
      )
        ? [
            {
              categoryKey: RATE_KEY,
              categoryName: 'Tỷ lệ lãi gộp ký gửi / Lãi gộp',
              amount: rate,
            },
            ...commissionItems,
          ]
        : commissionItems,
    netAfterCommission: sum((r) => r.netAfterCommission),
  };
}

/**
 * Gom các tháng (cũ đến mới) thành các kỳ `size` tháng, tính từ tháng cuối lùi về. Số tháng
 * thừa ở đầu, nếu có, bị bỏ.
 */
export function groupPnlPeriods(
  months: PnlMonthRow[],
  size: number,
): PnlMonthRow[] {
  if (size <= 1) return months;
  const groups: PnlMonthRow[] = [];
  for (let end = months.length; end - size >= 0; end -= size) {
    groups.unshift(mergePnlMonths(months.slice(end - size, end)));
  }
  return groups;
}
