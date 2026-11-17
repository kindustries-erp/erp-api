import type { PaginationMeta } from '@/common/utils/paginated-result';

export interface TimeHorizonCaseItem {
  id: string;
  caseId: string | null;
  soChungTu: string | null;
  bienSoXe: string | null;
  customerCode: string | null;
  customerName: string | null;
  direction: 'OUT';
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  completionDate: string | null;
  agingDays: number;
  branchExternalId: string | null;
  status: string;
  description: string;
}

export interface TimeHorizonSummary {
  horizon: string;
  horizonLabel: string;
  receivableAmount: number;
  receivableTotalAmount: number;
  receivedAmount: number;
  receivableCount: number;
  topPartners: Array<{
    partnerCode: string;
    partnerName: string;
    partnerType: 'CUSTOMER';
    balanceAmount: number;
    caseCount: number;
    sharePercentage: number;
  }>;
}

/** Response v2: `items` + `pagination`, phần tổng hợp của mốc nằm trong `extraData.summary`. */
export interface TimeHorizonCasesResponse {
  items: TimeHorizonCaseItem[];
  pagination: PaginationMeta;
  extraData: { summary: TimeHorizonSummary };
}
