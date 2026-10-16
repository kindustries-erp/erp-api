/** Một khoản (chi phí vận hành, hoa hồng) trong báo cáo P&L tháng. */
export interface PnlLineItem {
  categoryKey: string;
  categoryName: string;
  amount: number;
}

/** P&L một tháng đã rút gọn từ `GaragePnlService.getPnlReport`. */
export interface PnlMonthRow {
  year: number;
  month: number;
  revenue: number;
  /** Chi phí phụ tùng ngoài & gia công ngoài (giá vốn). */
  cogs: number;
  grossProfit: number;
  /** Tỷ lệ lợi nhuận gộp trên doanh thu, 0..100. */
  grossMarginRate: number;
  opexTotal: number;
  opexItems: PnlLineItem[];
  netBeforeCommission: number;
  commissionTotal: number;
  commissionItems: PnlLineItem[];
  netAfterCommission: number;
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
  (Array.isArray(items) ? items : []).map((i: any) => ({
    categoryKey: String(i?.categoryKey ?? ''),
    categoryName: String(i?.categoryName ?? ''),
    amount: num(i?.amount),
  }));

/** Rút gọn kết quả `getPnlReport` thành dòng P&L của tháng. */
export function toPnlMonthRow(ref: PnlMonthRef, report: any): PnlMonthRow {
  return {
    year: ref.year,
    month: ref.month,
    revenue: num(report?.revenue),
    cogs: num(report?.cogs),
    grossProfit: num(report?.grossProfit),
    grossMarginRate: num(report?.grossMarginRate),
    opexTotal: num(report?.opex?.total),
    opexItems: mapItems(report?.opex?.items),
    netBeforeCommission: num(report?.netProfitBeforeCommission),
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
