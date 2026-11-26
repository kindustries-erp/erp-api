/** Khoảng ngày `YYYY-MM-DD` (gồm cả hai đầu) cho một lượt gọi KGara. */
export interface SyncDateRange {
  from: string;
  to: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** Số ngày của tháng `m` (1..12). */
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

function parseYmd(value: string): [number, number, number] | null {
  const match = DATE_RE.exec(value ?? '');
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Tách `from..to` thành các đoạn theo tháng dương lịch, tháng mới nhất trước.
 * Đoạn đầu và cuối được cắt theo `from`/`to`; các đoạn không chồng, không hở.
 * Ngày không hợp lệ hoặc `from > to` thì trả mảng rỗng.
 */
export function splitMonthlyRanges(from: string, to: string): SyncDateRange[] {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return [];
  const start = fmt(...a);
  const end = fmt(...b);
  if (start > end) return [];

  const ranges: SyncDateRange[] = [];
  let [y, m] = [b[0], b[1]];
  while (y > a[0] || (y === a[0] && m >= a[1])) {
    const monthStart = fmt(y, m, 1);
    const monthEnd = fmt(y, m, daysInMonth(y, m));
    ranges.push({
      from: monthStart < start ? start : monthStart,
      to: monthEnd > end ? end : monthEnd,
    });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return ranges;
}

/**
 * Khoảng "N tháng gần nhất" tính từ ngày `today` (`YYYY-MM-DD`): từ đúng ngày đó N tháng trước
 * (ngày lớn hơn số ngày của tháng đích thì lấy ngày cuối tháng) đến `today`.
 */
export function recentMonthsRange(
  today: string,
  months: number,
): SyncDateRange | null {
  const t = parseYmd(today);
  if (!t || months < 0) return null;
  const total = t[0] * 12 + (t[1] - 1) - months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const d = Math.min(t[2], daysInMonth(y, m));
  return { from: fmt(y, m, d), to: fmt(...t) };
}

/** Số tháng quét khi bấm đồng bộ và ở lượt tự động cuối ngày. */
export const KGARA_RECENT_SYNC_MONTHS = 6;
