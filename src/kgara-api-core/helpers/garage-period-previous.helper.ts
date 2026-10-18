const DAY_MS = 24 * 60 * 60 * 1000;

const toDayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Kỳ trọn tháng (1 → cuối tháng, có thể nhiều tháng) so với các tháng liền trước theo lịch. */
function previousCalendarRange(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const lastOfTo = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const toDd = Number(to.slice(8, 10));
  if (fd !== 1 || toDd !== lastOfTo) return undefined;
  const months = (ty - fy) * 12 + (tm - fm) + 1;
  const prevFrom = new Date(Date.UTC(fy, fm - 1 - months, 1));
  return {
    from: toDay(prevFrom.getTime()),
    to: toDay(toDayMs(from) - DAY_MS),
  };
}

/**
 * Kỳ liền trước để so sánh ±% (`YYYY-MM-DD`): kỳ trọn tháng so với các tháng liền trước, còn
 * lại lấy khoảng cùng độ dài nối ngay trước `from`. Trả `undefined` khi thiếu kỳ hoặc kỳ trước
 * bắt đầu trước `baseline` (công nợ chưa có số liệu).
 */
export function previousPeriodRange(
  from: string | undefined,
  to: string | undefined,
  baseline: string,
): { from: string; to: string } | undefined {
  if (!from || !to) return undefined;
  const days = Math.round((toDayMs(to) - toDayMs(from)) / DAY_MS) + 1;
  if (!(days > 0)) return undefined;
  const range =
    previousCalendarRange(from, to) ??
    (() => {
      const prevTo = toDay(toDayMs(from) - DAY_MS);
      return { from: toDay(toDayMs(prevTo) - (days - 1) * DAY_MS), to: prevTo };
    })();
  if (range.from < baseline) return undefined;
  return range;
}
