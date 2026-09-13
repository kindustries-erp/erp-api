/**
 * Safely parse date from various formats without producing Invalid Date / NaN
 */
export function parseSafeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed === 'null' ||
      trimmed === 'undefined' ||
      trimmed.includes('NaN') ||
      trimmed.startsWith('0001-01-01') ||
      trimmed.startsWith('1900-01-01')
    ) {
      return null;
    }
    // Check if DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
    );
    if (dmyMatch) {
      const [, d, m, y, hh, mm, ss] = dmyMatch;
      const isoFormatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${
        hh
          ? `T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${(ss || '00').padStart(2, '0')}`
          : 'T00:00:00'
      }`;
      const parsed = new Date(isoFormatted);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Safely extract net total payable amount from case data / raw payload
 * Prioritizes TongTienThanhToan / TienThanhToanKH / (TienCoThue - TienChietKhau)
 */
export function extractNetPayableAmount(item: any): number {
  if (!item) return 0;
  const raw = item.rawData || item;

  const tongTienThanhToan = Number(raw.TongTienThanhToan);
  if (!isNaN(tongTienThanhToan) && tongTienThanhToan > 0) {
    return tongTienThanhToan;
  }

  const tienThanhToanKH = Number(raw.TienThanhToanKH);
  if (!isNaN(tienThanhToanKH) && tienThanhToanKH > 0) {
    return tienThanhToanKH;
  }

  const tienCoThue = Number(raw.TienCoThue ?? item.tienCoThue ?? 0);
  const tienChietKhau = Number(raw.TienChietKhau ?? 0);
  if (tienChietKhau > 0 && tienCoThue > tienChietKhau) {
    return tienCoThue - tienChietKhau;
  }

  return isNaN(tienCoThue) ? 0 : tienCoThue;
}
