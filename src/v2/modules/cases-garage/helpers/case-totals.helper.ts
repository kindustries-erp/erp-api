import type { CaseServiceLineDto } from '../dto/case-service-line.dto';
import type { CaseServiceGarage } from '../entities/case-service-garage.entity';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

type LineFields = Partial<CaseServiceGarage>;

/** Tính thành tiền một dòng nhập tay từ DTO. Trả field entity (numeric dạng string). */
export function computeLineAmounts(dto: CaseServiceLineDto): LineFields {
  const hasQtyPrice = dto.quantity != null && dto.unitPrice != null;
  const base = hasQtyPrice
    ? n(dto.quantity) * n(dto.unitPrice)
    : n(dto.serviceAmount) + n(dto.partsAmount);
  const before = r2(base - n(dto.lineDiscountAmount) + n(dto.surchargeAmount));
  const withTax = r2(before * (1 + n(dto.taxRate) / 100));
  const isParts = dto.productTypeCode === 'PT';
  return {
    amountBeforeTax: before.toFixed(2),
    amountWithTax: withTax.toFixed(2),
    serviceAmount: (dto.serviceAmount ?? (isParts ? 0 : before)).toFixed(2),
    partsAmount: (dto.partsAmount ?? (isParts ? before : 0)).toFixed(2),
  };
}

export interface CaseTotals {
  totalAmountWithTax: string;
  revenue: string;
  cost: string;
  profit: string;
  outstandingAmount: string;
}

/** Tổng header từ các dòng còn hiệu lực. `paid` là số đã thu (0 cho tới khi nối cấn trừ). */
export function computeCaseTotals(
  lines: ReadonlyArray<LineFields>,
  paid: number | string | null = 0,
): CaseTotals {
  const live = lines.filter((l) => !l.externalDeletedAt);
  const total = r2(live.reduce((s, l) => s + n(l.amountWithTax), 0));
  const revenue = r2(live.reduce((s, l) => s + n(l.amountBeforeTax), 0));
  const cost = r2(live.reduce((s, l) => s + n(l.partsCost), 0));
  return {
    totalAmountWithTax: total.toFixed(2),
    revenue: revenue.toFixed(2),
    cost: cost.toFixed(2),
    profit: r2(revenue - cost).toFixed(2),
    outstandingAmount: r2(Math.max(0, total - n(paid))).toFixed(2),
  };
}
