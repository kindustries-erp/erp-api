/** Một khoản (chi phí vận hành, hoa hồng) trong báo cáo P&L tháng. */
export interface PnlLineItem {
  categoryKey: string;
  categoryName: string;
  amount: number;
  /** Ghi chú của dòng nhập (nhãn cấp 3 của báo cáo lợi nhuận); thiếu thì không có. */
  note?: string;
}

/** Doanh thu và giá vốn từ phiếu của một nhóm phân loại trong tháng. */
export interface PnlRevenueSegment {
  key: string;
  label: string;
  caseCount: number;
  revenue: number;
  cogs: number;
}

/** P&L một tháng đã rút gọn từ `GaragePnlService.getPnlReport`. */
export interface PnlMonthRow {
  year: number;
  month: number;
  revenue: number;
  /** Giá vốn gồm giá vốn từ phiếu và điều chỉnh giá vốn nhập tay. */
  cogs: number;
  /** Chi phí phụ tùng ngoài & gia công ngoài lấy từ phiếu (chưa gồm điều chỉnh nhập tay). */
  cogsDirect: number;
  /** Điều chỉnh giá vốn nhập tay (hoa hồng trực tiếp, chi phí trực tiếp khác, vật tư tiêu hao). */
  cogsAdjustmentItems: PnlLineItem[];
  /** Doanh thu theo phân loại phiếu; tổng bằng `revenue`. */
  revenueSegments: PnlRevenueSegment[];
  grossProfit: number;
  /** Tỷ lệ lợi nhuận gộp trên doanh thu, 0..100. */
  grossMarginRate: number;
  opexTotal: number;
  opexItems: PnlLineItem[];
  financialTotal?: number;
  financialItems?: PnlLineItem[];
  netBeforeCommission: number;
  /** Chi phí bán hàng (HHBH) đã trừ trong lợi nhuận ròng sau hoa hồng. */
  hhbhTotal: number;
  commissionTotal: number;
  commissionItems: PnlLineItem[];
  netAfterCommission: number;
  /** Kỳ đã cộng gộp (quý, nhiều tháng): tháng đầu và số tháng; thiếu thì là một tháng (`year`/`month`). */
  periodStart?: PnlMonthRef;
  periodMonths?: number;
}

export interface OpexBuckets {
  nhanSu: number;
  matBang: number;
  vatTu: number;
  baoTri: number;
  khauHao: number;
  khac: number;
}

export interface PnlMonthRef {
  year: number;
  month: number;
}

const num = (value: unknown) => Number(value) || 0;

const mapItems = (items: unknown): PnlLineItem[] =>
  (Array.isArray(items) ? items : []).map((i: any) => {
    const item: PnlLineItem = {
      categoryKey: String(i?.categoryKey ?? ''),
      categoryName: String(i?.categoryName ?? ''),
      amount: num(i?.amount),
    };
    const note = typeof i?.note === 'string' ? i.note.trim() : '';
    return note ? { ...item, note } : item;
  });

const mapSegments = (segments: unknown): PnlRevenueSegment[] =>
  (Array.isArray(segments) ? segments : []).map((s: any) => ({
    key: String(s?.key ?? ''),
    label: String(s?.label ?? ''),
    caseCount: num(s?.caseCount),
    revenue: num(s?.revenue),
    cogs: num(s?.cogs),
  }));

/** Rút gọn kết quả `getPnlReport` thành dòng P&L của tháng. */
export function toPnlMonthRow(ref: PnlMonthRef, report: any): PnlMonthRow {
  return {
    year: ref.year,
    month: ref.month,
    revenue: num(report?.revenue),
    cogs: num(report?.cogs),
    cogsDirect: num(report?.cogsDirect),
    cogsAdjustmentItems: mapItems(report?.cogsAdjustment?.items),
    revenueSegments: mapSegments(report?.revenueByClassification),
    grossProfit: num(report?.grossProfit),
    grossMarginRate: num(report?.grossMarginRate),
    opexTotal: num(report?.opex?.total),
    opexItems: mapItems(report?.opex?.items),
    financialTotal: num(report?.financialExpenses?.total),
    financialItems: mapItems(report?.financialExpenses?.items),
    netBeforeCommission: num(report?.netProfitBeforeCommission),
    hhbhTotal: num(
      (Array.isArray(report?.sellingExpenses?.items)
        ? report.sellingExpenses.items
        : []
      ).find((i: any) => i?.categoryKey === 'HHBH')?.amount,
    ),
    commissionTotal: num(report?.commission?.total),
    commissionItems: mapItems(report?.commission?.items),
    netAfterCommission: num(report?.netProfitAfterCommission),
  };
}

/**
 * Tháng báo cáo: tháng chứa `to` nhưng không vượt tháng hiện tại; thiếu `to` thì
 * tháng hiện tại.
 */
export function reportMonthOf(
  to: string | undefined,
  today: Date = new Date(),
): PnlMonthRef {
  const current = { year: today.getFullYear(), month: today.getMonth() + 1 };
  const match = /^(\d{4})-(\d{2})/.exec(to ?? '');
  if (!match) return current;
  const ref = { year: Number(match[1]), month: Number(match[2]) };
  if (ref.month < 1 || ref.month > 12) return current;
  const isFuture =
    ref.year > current.year ||
    (ref.year === current.year && ref.month > current.month);
  return isFuture ? current : ref;
}

/** `count` tháng liên tiếp kết thúc ở `end`, sắp từ cũ đến mới. */
export function monthWindow(end: PnlMonthRef, count = 12): PnlMonthRef[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const index = end.year * 12 + (end.month - 1) - offset;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  });
}

/** Nhãn trục `2026-thg 7`. */
export const monthLabel = (ref: PnlMonthRef) => `${ref.year}-thg ${ref.month}`;

/**
 * Gom khoản chi phí vận hành vào các nhóm của chart tỷ trọng. Khóa lạ rơi vào
 * `khac` để tổng các nhóm luôn bằng tổng chi phí vận hành.
 */
export function bucketOpex(items: PnlLineItem[]): OpexBuckets {
  const buckets: OpexBuckets = {
    nhanSu: 0,
    matBang: 0,
    vatTu: 0,
    baoTri: 0,
    khauHao: 0,
    khac: 0,
  };
  for (const item of items) {
    const key = item.categoryKey.toUpperCase();
    const name = item.categoryName.toLowerCase();
    if (key === 'NHAN_SU' || name.includes('nhân sự'))
      buckets.nhanSu += item.amount;
    else if (
      key === 'THUE_MAT_BANG' ||
      name.includes('mặt bằng') ||
      name.includes('điện nước')
    )
      buckets.matBang += item.amount;
    else if (key.includes('VAT_TU') || name.includes('vật tư'))
      buckets.vatTu += item.amount;
    else if (key === 'BAO_TRI' || name.includes('bảo trì'))
      buckets.baoTri += item.amount;
    else if (key === 'KHAU_HAO' || name.includes('khấu hao'))
      buckets.khauHao += item.amount;
    else buckets.khac += item.amount;
  }
  return buckets;
}

/** Điểm một tháng của 2 chart dashboard: combo lợi nhuận và tỷ trọng chi phí / doanh thu. */
export interface PnlTrendPoint {
  year: number;
  month: number;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** Lợi nhuận gộp / doanh thu (0..1), `null` khi không có doanh thu. */
  grossMarginRatio: number | null;
  /** Tỷ trọng trên doanh thu (0..1), doanh thu 0 thì 0. */
  ratios: {
    cogs: number;
    nhanSu: number;
    matBang: number;
    vatTu: number;
    baoTri: number;
    khauHao: number;
    khac: number;
  };
}

/** Cùng công thức với sheet "Báo cáo lợi nhuận" của file Excel xuất theo kỳ. */
export function toPnlTrendPoint(row: PnlMonthRow): PnlTrendPoint {
  const b = bucketOpex(row.opexItems);
  const ratio = (part: number) => (row.revenue > 0 ? part / row.revenue : 0);
  return {
    year: row.year,
    month: row.month,
    label: monthLabel(row),
    revenue: row.revenue,
    cogs: row.cogs,
    grossProfit: row.grossProfit,
    grossMarginRatio: row.revenue > 0 ? row.grossProfit / row.revenue : null,
    ratios: {
      cogs: ratio(row.cogs),
      nhanSu: ratio(b.nhanSu),
      matBang: ratio(b.matBang),
      vatTu: ratio(b.vatTu),
      baoTri: ratio(b.baoTri),
      khauHao: ratio(b.khauHao),
      khac: ratio(b.khac),
    },
  };
}
