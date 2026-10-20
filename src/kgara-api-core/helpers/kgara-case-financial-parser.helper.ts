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
      const costVal = Number(
        item.ChiPhi || item.ChiPhiVon || item.GiaTriTien || 0,
      );
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

    const totalCost =
      warehousePartsCost +
      outsourceCost +
      commissionCost +
      discountCost +
      otherCost;

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
