export function getGMT7YearMonthString(
  dateInput?: Date | string | null,
): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${partMap.year}${partMap.month}`;
}

export function getGMT7YearMonthDayString(
  dateInput?: Date | string | null,
): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${partMap.year}${partMap.month}${partMap.day}`;
}

/**
 * Chuyển đổi timestamp (UTC hoặc Date) thành đối tượng Date với giờ Việt Nam (Asia/Ho_Chi_Minh GMT+7)
 * được đặt vào UTC components để ExcelJS ghi ra OLE Automation Serial Number tương thích Excel.
 */
export function toVietnamExcelDate(
  dateInput?: Date | string | null,
): Date | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  // en-GB hour can return "24" in rare cases depending on Intl implementation, normalize:
  const rawHour = parseInt(partMap.hour, 10);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = parseInt(partMap.minute, 10);
  const second = parseInt(partMap.second, 10);

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}
