const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYYMMDD_HHmmss` theo giờ local của process. */
export function formatExportTimestamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** `YYYYMMDD_HHmm` (không giây). Dùng cho tên file sao kê, giữ nguyên như cũ. */
export function formatExportTimestampNoSeconds(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}`
  );
}
