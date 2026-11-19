import type { PaginationMeta } from '@/common/utils/paginated-result';
import type { SummaryMetric } from '@/common/utils/table-query';
import type { CaseOrigin } from '../entities/case-garage.enums';

/** Một hạng mục dịch vụ hoặc phụ tùng của vụ việc, kèm thông tin vụ việc. Số tiền là number. */
export interface CaseServiceRow {
  id: string;
  caseId: string;
  origin: CaseOrigin;
  externalId: string | null;
  caseCode: string | null;
  licensePlate: string | null;
  customerCode: string | null;
  customerName: string | null;
  caseDate: string | null;
  completedDate: string | null;
  branchExternalId: string | null;
  branchName: string | null;
  kgaraStatusCode: number;
  statusName: string | null;
  classification: string | null;
  productCode: string | null;
  productName: string | null;
  description: string | null;
  productTypeCode: string | null;
  unitName: string | null;
  quantity: number;
  unitPrice: number;
  amountBeforeTax: number;
  taxRate: number;
  amountWithTax: number;
  laborHours: number;
  serviceAmount: number;
  partsAmount: number;
  partsCost: number;
  lineDiscountRate: number;
  lineDiscountAmount: number;
  warehouseCode: string | null;
  surchargeAmount: number;
}

export interface CaseServicesResponse {
  items: CaseServiceRow[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}
