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

/**
 * Trích xuất trường Phân loại xe (NguonGocKhachHangName / NguonGocKhachHangCode) từ payload KGara
 */
export function extractKgaraClassification(item: any): {
  kgaraClassification: string | null;
  kgaraClassificationCode: string | null;
} {
  if (!item)
    return { kgaraClassification: null, kgaraClassificationCode: null };
  const raw = item.rawData || item;

  const code =
    (
      raw.NguonGocKhachHangCode ??
      raw.nguonGocKhachHangCode ??
      item.kgaraClassificationCode ??
      ''
    )
      ?.toString()
      .trim() || null;
  const name =
    (
      raw.NguonGocKhachHangName ??
      raw.nguonGocKhachHangName ??
      item.kgaraClassification ??
      ''
    )
      ?.toString()
      .trim() || null;

  return {
    kgaraClassification: name,
    kgaraClassificationCode: code,
  };
}

/**
 * Ánh xạ giá trị NguonGocKhachHang từ KGara → ERP classification.
 * Quy tắc:
 * 1. NBPQ (Nội Bộ PQ) -> 'OJ'
 * 2. Sales tặng -> 'KHAC'
 * 3. Tất cả các phân loại còn lại từ KGara (Xe ký gửi, Ký gửi NSG, KG-NB...) -> 'KY_GUI_NOI_BO'
 * 4. Không có dữ liệu (null/rỗng) -> null (chờ user phân loại trên ERP)
 *
 * Chú ý: Kết quả này CHỈ dùng để tự động điền khi classification trong DB đang là NULL.
 * Không bao giờ dùng để ghi đè classification đã có trên ERP.
 */
export function mapKgaraClassificationToErp(
  nguonGocCode?: string | null,
  nguonGocName?: string | null,
): string | null {
  const normCode = (nguonGocCode || '').trim().toUpperCase();
  const normName = (nguonGocName || '').trim().toUpperCase();

  // Không có thông tin từ KGara -> giữ null
  if (!normCode && !normName) {
    return null;
  }

  // 1. NBPQ (Nội Bộ Phú Quốc) -> OJ
  if (
    normCode === 'NBPQ' ||
    normName.includes('NỘI BỘ PQ') ||
    normName.includes('NOI BO PQ')
  ) {
    return 'OJ';
  }

  // 2. Sales tặng -> KHAC
  if (
    normCode.includes('SALES') ||
    normName.includes('SALES TẶNG') ||
    normName.includes('SALES TANG')
  ) {
    return 'KHAC';
  }

  // 3. Tất cả các trường hợp còn lại có phân loại từ KGara -> KY_GUI_NOI_BO
  return 'KY_GUI_NOI_BO';
}
