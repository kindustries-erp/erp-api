export interface InvoiceFileNameSource {
  invoiceDate?: string | Date | null;
  serialNo?: string | null;
  invoiceNo?: string | null;
  totalAmount?: string | number | null;
  id?: string;
}

const MAX_PART_LENGTH = 40;

function sanitizePart(val: string | null | undefined, fallback: string) {
  const cleaned = (val ?? '')
    .trim()
    .replace(/[\\/:"*?<>|\s]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .substring(0, MAX_PART_LENGTH);
  return cleaned || fallback;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'KhongNgay';
  const iso =
    date instanceof Date ? date.toISOString().slice(0, 10) : String(date);
  const digits = iso.slice(0, 10).replace(/-/g, '');
  return /^\d{8}$/.test(digits) ? digits : 'KhongNgay';
}

function formatAmount(amount: string | number | null | undefined): string {
  const n = Math.round(Number(amount));
  return Number.isFinite(n) ? String(n) : '0';
}

/**
 * Tên file hóa đơn: `{YYYYMMDD}_{KyHieu}_{SoHD}_{SoTien}[_{index}].{ext}`.
 * `index` (1-based) dùng khi một hóa đơn có nhiều file cùng loại.
 */
export function buildInvoiceFileName(
  invoice: InvoiceFileNameSource,
  ext: string,
  index?: number,
): string {
  const parts = [
    formatDate(invoice.invoiceDate),
    sanitizePart(invoice.serialNo, 'KhongKyHieu'),
    sanitizePart(invoice.invoiceNo, invoice.id || 'KhongSoHD'),
    formatAmount(invoice.totalAmount),
  ];
  const suffix = index ? `_${index}` : '';
  const safeExt = sanitizePart(ext, 'pdf').toLowerCase();
  return `${parts.join('_')}${suffix}.${safeExt}`;
}

/** Thêm `_2`, `_3`... nếu tên đã dùng trong `used` (đường dẫn đầy đủ trong ZIP). */
export function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  let n = 2;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  while (used.has(candidate)) {
    candidate = `${base}_${n++}${ext}`;
  }
  used.add(candidate);
  return candidate;
}
