/** Khoảng ngày dạng `YYYY-MM-DD`, hai đầu bao gồm. */
export interface GdtDateWindow {
  from: string;
  to: string;
}

export const GDT_WINDOW_MIN_DAYS = 1;
export const GDT_WINDOW_MAX_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Chuyển `YYYY-MM-DD` thành số ngày kể từ epoch (không dính múi giờ). */
function isoToDayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function dayNumberToIso(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/** Ngày hôm nay theo giờ Việt Nam, dạng `YYYY-MM-DD`. */
export function getVietnamTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Cộng/trừ số ngày cho một `YYYY-MM-DD`. */
export function shiftIsoDate(iso: string, days: number): string {
  return dayNumberToIso(isoToDayNumber(iso) + days);
}

/** Kẹp số ngày mỗi cửa sổ vào khoảng cho phép [1, 31]. */
export function clampWindowDays(days: number): number {
  if (!Number.isFinite(days)) return GDT_WINDOW_MAX_DAYS;
  return Math.min(
    GDT_WINDOW_MAX_DAYS,
    Math.max(GDT_WINDOW_MIN_DAYS, Math.floor(days)),
  );
}

/**
 * Chia khoảng [from, to] thành các cửa sổ liên tiếp, mỗi cửa sổ tối đa `windowDays` ngày.
 * Trả về rỗng nếu `from` sau `to`.
 */
export function buildDateWindows(
  from: string,
  to: string,
  windowDays: number,
): GdtDateWindow[] {
  const size = clampWindowDays(windowDays);
  const start = isoToDayNumber(from);
  const end = isoToDayNumber(to);
  const windows: GdtDateWindow[] = [];

  for (let cursor = start; cursor <= end; cursor += size) {
    const windowEnd = Math.min(cursor + size - 1, end);
    windows.push({
      from: dayNumberToIso(cursor),
      to: dayNumberToIso(windowEnd),
    });
  }
  return windows;
}

/** Đổi `YYYY-MM-DD` sang `dd/MM/yyyy` theo định dạng tham số `search` của cổng GDT. */
export function toGdtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Nhãn cửa sổ dùng trong log và thông báo lỗi, ví dụ `01/10/2026` hoặc `01/10/2026-10/10/2026`. */
export function formatDateWindowLabel(window: GdtDateWindow): string {
  return window.from === window.to
    ? toGdtDate(window.from)
    : `${toGdtDate(window.from)}-${toGdtDate(window.to)}`;
}

/**
 * Chia đôi một cửa sổ khi cổng từ chối hoặc chạm trần số bản ghi.
 * Trả về `null` nếu cửa sổ đã là một ngày (không chia được nữa).
 */
export function splitDateWindow(
  window: GdtDateWindow,
): [GdtDateWindow, GdtDateWindow] | null {
  const start = isoToDayNumber(window.from);
  const end = isoToDayNumber(window.to);
  if (end <= start) return null;

  const mid = start + Math.floor((end - start) / 2);
  return [
    { from: window.from, to: dayNumberToIso(mid) },
    { from: dayNumberToIso(mid + 1), to: window.to },
  ];
}
