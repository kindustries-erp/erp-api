import { ojHasInvoiceOf } from '@/kgara-api-core/helpers/kgara-oj-debt-rule.helper';
import type { CaseListItem } from '../dto/case-list.types';
import type { CaseGarage } from '../entities/case-garage.entity';
import type { CaseLinkCounts, CaseSettlementSums } from './case-list.mapper';
import { toCaseResponse } from './case-response.mapper';

export interface CaseCategoryRef {
  id: string;
  code: string | null;
  name: string | null;
}

/** Lãi gộp KGara khớp theo mã chứng từ, dùng làm giá trị dự phòng khi header chưa có số. */
export interface CaseGrossProfitRef {
  revenue: number | string | null;
  cost: number | string | null;
  profit: number | string | null;
}

export interface CaseListExtras {
  settlement?: CaseSettlementSums;
  links?: CaseLinkCounts;
  category?: CaseCategoryRef | null;
  grossProfit?: CaseGrossProfitRef | null;
  /** Id phiếu OJ đã gắn hóa đơn đầu ra còn hiệu lực. */
  ojInvoicedIds?: ReadonlySet<string>;
}

const num = (v: number | string | null | undefined): number | null =>
  v == null || v === '' ? null : Number(v);

/** Header v2 + số liệu dẫn xuất (cấn trừ, hóa đơn liên kết, lãi gộp, biên lợi nhuận) → dòng danh sách. */
export function toCaseListItem(
  c: CaseGarage,
  x: CaseListExtras = {},
): CaseListItem {
  const { services: _services, ...base } = toCaseResponse(c);
  const revenue = base.revenue ?? num(x.grossProfit?.revenue);
  const cost = base.cost ?? num(x.grossProfit?.cost);
  const profit =
    base.profit ??
    num(x.grossProfit?.profit) ??
    (revenue != null ? revenue - (cost ?? 0) : null);
  const total = base.totalAmountWithTax ?? 0;
  const paid = x.settlement?.hasReceipt
    ? x.settlement.receipts
    : (base.paidAmount ?? 0);
  return {
    ...base,
    revenue,
    cost,
    profit,
    margin:
      revenue && revenue > 0 && profit != null
        ? Math.round((profit / revenue) * 1000) / 10
        : null,
    classification: x.category?.code ?? base.classification,
    category: x.category ?? null,
    paidAmount: paid,
    outstandingAmount: Math.max(0, total - paid),
    paidOutAmount: x.settlement?.payments ?? 0,
    linkedInvoiceCount: x.links?.total ?? 0,
    linkedInvoiceOutCount: x.links?.outCount ?? 0,
    linkedInvoiceInCount: x.links?.inCount ?? 0,
    ojHasInvoice: ojHasInvoiceOf(base, x.ojInvoicedIds),
  };
}
