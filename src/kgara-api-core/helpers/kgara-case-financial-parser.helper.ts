export interface KgaraCaseFinancialSummary {
  driverName: string | null;
  totalAmount: number;
  discountRate: number;
  discountAmount: number;
  subtotalAfterDiscount: number;
  deductibleAmount: number;
  sanctionAmount: number;
  totalDeductibleAndSanction: number;
  afterSanctionAmount: number;
  vatAmount: number;
  vatRate: number;
  customerPay: number;
  insurancePay: number;
  totalPayable: number;
  commissionGeneral: number;
  commissionGdv: number;
  commissionGdvRate: number;
  gdvName: string | null;
  commissionMg: number;
  commissionMgRate: number;
  brokerName: string | null;
  isInsurance: boolean;
}

export interface EstimatedProfitCalculation {
  partsCostInside: number;
  partsCostOutside: number;
  outsourceCost: number;
  totalCost: number;
  estimatedProfitPreTax: number;
  estimatedProfitAfterTax: number;
}

export interface JournalCostBreakdown {
  warehousePartsCost: number; // TK 1541
  outsourceCost: number; // TK 1542
  commissionCost: number; // TK 1543
  discountCost: number; // TK 521
  otherCost: number;
  totalCost: number;
}

/** TK có `GiaTriTien` là số tiền chi phí/giảm trừ khi `ChiPhi` vắng (khác doanh thu 131/511). */
const COST_TK_WITH_VALUE_FALLBACK = new Set(['1541', '1542', '1543', '521']);

/**
 * Số tiền chi phí của một dòng định khoản. Dùng `ChiPhi ?? ChiPhiVon`; `GiaTriTien` chỉ là
 * dự phòng cho TK chi phí/giảm trừ khi cả hai vắng. Không dùng `||` vì dòng doanh thu
 * (Nợ 131) có `ChiPhi = 0` và `GiaTriTien > 0` sẽ bị tính nhầm thành chi phí.
 */
export function journalItemCostAmount(item: any, tkNo: string): number {
  const direct = item?.ChiPhi ?? item?.ChiPhiVon;
  if (direct != null && direct !== '') {
    const n = Number(direct);
    return Number.isFinite(n) ? n : 0;
  }
  if (COST_TK_WITH_VALUE_FALLBACK.has(tkNo)) {
    const n = Number(item?.GiaTriTien ?? 0);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export class KgaraCaseFinancialParserHelper {
  static parseFinancialSummary(rawData: any): KgaraCaseFinancialSummary {
    const discountAmount = Number(rawData?.TienChietKhau || 0);
    const discountRate = Number(rawData?.TyLeChietKhau || 0);

    const rawTienChuaThue = Number(rawData?.TienChuaThue || 0);
    const rawTongTienHang = Number(rawData?.TongTienHang || 0);

    let totalAmount = 0;
    let subtotalAfterDiscount = 0;

    if (
      rawTienChuaThue > 0 &&
      rawTongTienHang > 0 &&
      rawTienChuaThue > rawTongTienHang
    ) {
      totalAmount = rawTienChuaThue;
      subtotalAfterDiscount = rawTongTienHang;
    } else if (rawTienChuaThue > 0) {
      totalAmount = rawTienChuaThue;
      subtotalAfterDiscount = Math.max(0, totalAmount - discountAmount);
    } else if (rawTongTienHang > 0) {
      if (discountAmount > 0) {
        totalAmount = rawTongTienHang + discountAmount;
        subtotalAfterDiscount = rawTongTienHang;
      } else {
        totalAmount = rawTongTienHang;
        subtotalAfterDiscount = rawTongTienHang;
      }
    }

    const deductibleAmount = Number(rawData?.TienKhauTruBaoHiem || 0);
    const sanctionAmount = Number(rawData?.TienChiPhiCheTai || 0);
    const totalDeductibleAndSanction = deductibleAmount + sanctionAmount;

    const afterSanctionAmount =
      rawData?.TienSauCheTai != null
        ? Number(rawData.TienSauCheTai)
        : Math.max(0, subtotalAfterDiscount - totalDeductibleAndSanction);

    const vatAmount = Number(rawData?.TienThue || 0);
    const vatRate = Number(rawData?.ThueSuat || 0);
    const customerPay = Number(rawData?.TienThanhToanKH || 0);
    const insurancePay = Number(rawData?.TienThanhToanBH || 0);
    const totalPayable = Number(
      rawData?.TongTienThanhToan || rawData?.TienCoThue || 0,
    );

    const commissionGeneral = Number(rawData?.TienHoaHong || 0);
    const commissionGdv = Number(rawData?.TienHoaHongBaoHiem || 0);
    const commissionGdvRate = Number(rawData?.TyLeHoaHongBaoHiem || 0);
    const gdvName = rawData?.GiamDinhVienName || null;

    const commissionMg = Number(rawData?.TienHoaHongMoiGioi || 0);
    const commissionMgRate = Number(rawData?.TyLeHoaHongMoiGioi || 0);
    const brokerName = rawData?.NguoiMoiGioiName || null;

    const isInsurance = Boolean(
      rawData?.XeLamBaoHiem ||
      insurancePay > 0 ||
      deductibleAmount > 0 ||
      sanctionAmount > 0 ||
      commissionGdv > 0,
    );

    return {
      driverName: rawData?.TenLaiXe || null,
      totalAmount,
      discountRate,
      discountAmount,
      subtotalAfterDiscount,
      deductibleAmount,
      sanctionAmount,
      totalDeductibleAndSanction,
      afterSanctionAmount,
      vatAmount,
      vatRate,
      customerPay,
      insurancePay,
      totalPayable,
      commissionGeneral,
      commissionGdv,
      commissionGdvRate,
      gdvName,
      commissionMg,
      commissionMgRate,
      brokerName,
      isInsurance,
    };
  }

  static parseJournalCostBreakdown(journalItems: any[]): JournalCostBreakdown {
    if (!Array.isArray(journalItems) || journalItems.length === 0) {
      return {
        warehousePartsCost: 0,
        outsourceCost: 0,
        commissionCost: 0,
        discountCost: 0,
        otherCost: 0,
        totalCost: 0,
      };
    }
    let warehousePartsCost = 0;
    let outsourceCost = 0;
    let commissionCost = 0;
    let discountCost = 0;
    let otherCost = 0;

    for (const item of journalItems) {
      const tkNo = String(item.TaiKhoanNoCode || item.TaiKhoanNo || '');
      const costVal = journalItemCostAmount(item, tkNo);
      if (tkNo === '1541') {
        warehousePartsCost += costVal;
      } else if (tkNo === '1542') {
        outsourceCost += costVal;
      } else if (tkNo === '1543') {
        commissionCost += costVal;
      } else if (tkNo === '521') {
        discountCost += costVal;
      } else if (costVal > 0) {
        otherCost += costVal;
      }
    }

    // 521 là giảm trừ doanh thu, không thuộc chi phí (KGara: LoiNhuan = DoanhThu - ChiPhi,
    // trong đó ChiPhi thô đã gồm 521; ERP tách riêng để biên tính trên doanh thu thuần).
    const totalCost =
      warehousePartsCost + outsourceCost + commissionCost + otherCost;

    return {
      warehousePartsCost,
      outsourceCost,
      commissionCost,
      discountCost,
      otherCost,
      totalCost,
    };
  }

  static extractServiceOutsourceCost(line: any): number {
    if (!line) return 0;
    const directCost = Number(
      line.GCN ??
        line.gcn ??
        line.GiaCongNgoai ??
        line.giaCongNgoai ??
        line.ChiPhiThueNgoai ??
        line.chiPhiThueNgoai ??
        line.GiaChiNgoai ??
        0,
    );
    if (directCost > 0) return directCost;

    if (
      line.HTThanhToanThueNgoaiCode === 'CN-GCN' ||
      line.htThanhToanThueNgoaiCode === 'CN-GCN'
    ) {
      return Number(line.DonGiaThueNgoai ?? line.TienThueNgoai ?? 0);
    }
    return 0;
  }

  static calculateEstimatedProfit(
    summary: KgaraCaseFinancialSummary,
    partsCostInside = 0,
    partsCostOutside = 0,
    outsourceCost = 0,
  ): EstimatedProfitCalculation {
    const totalCost = partsCostInside + partsCostOutside + outsourceCost;
    const totalCommissions =
      summary.commissionGeneral + summary.commissionGdv + summary.commissionMg;

    const estimatedProfitPreTax =
      summary.subtotalAfterDiscount - totalCommissions - totalCost;

    const estimatedProfitAfterTax = estimatedProfitPreTax + summary.vatAmount;

    return {
      partsCostInside,
      partsCostOutside,
      outsourceCost,
      totalCost,
      estimatedProfitPreTax,
      estimatedProfitAfterTax,
    };
  }
}

/** Dòng dịch vụ đủ để suy ra thuế GTGT. */
export interface VatSourceLine {
  tienCoThue?: number | string | null;
  tienChuaThue?: number | string | null;
}

/** Phiếu đủ để suy ra thuế GTGT: tổng có thuế và rawData đồng bộ. */
export interface VatSourceCase {
  tienCoThue?: number | string | null;
  rawData?: Record<string, any> | null;
}

/** Thuế suất chuẩn được chấp nhận khi suy ra từ chênh lệch tổng và dòng. */
const STANDARD_VAT_RATES = [5, 8, 10];

const toPositiveNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/**
 * Thuế GTGT của phiếu dịch vụ. Bỏ qua giá trị 0/thiếu và thử nguồn tiếp theo:
 * 1. `rawData.TienThue`; 2. `TienThueKH + TienThueBH`;
 * 3. Tổng `(tienCoThue - tienChuaThue)` các dòng;
 * 4. Chênh lệch `tienCoThue - Σ tienChuaThue`, chỉ khi khớp thuế suất chuẩn 5/8/10%.
 */
export function resolveCaseVatAmount(
  caseRow: VatSourceCase,
  lines: VatSourceLine[] = [],
): number {
  const raw = caseRow.rawData ?? {};

  const fromTotal = toPositiveNumber(raw.TienThue);
  if (fromTotal) return fromTotal;

  const fromParts =
    toPositiveNumber(raw.TienThueKH) + toPositiveNumber(raw.TienThueBH);
  if (fromParts) return roundMoney(fromParts);

  const fromLines = lines.reduce(
    (sum, line) =>
      sum + Number(line.tienCoThue ?? 0) - Number(line.tienChuaThue ?? 0),
    0,
  );
  if (fromLines > 0) return roundMoney(fromLines);

  const net = lines.reduce(
    (sum, line) => sum + Number(line.tienChuaThue ?? 0),
    0,
  );
  const diff = Number(caseRow.tienCoThue ?? 0) - net;
  if (net > 0 && diff > 0) {
    const matchesStandardRate = STANDARD_VAT_RATES.some((rate) => {
      const expected = (net * rate) / 100;
      return Math.abs(diff - expected) <= expected * 0.001 + 1;
    });
    if (matchesStandardRate) return roundMoney(diff);
  }

  return 0;
}
