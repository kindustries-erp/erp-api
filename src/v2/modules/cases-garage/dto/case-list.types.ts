import type { PaginationMeta } from '@/common/utils/paginated-result';
import type { SummaryMetric } from '@/common/utils/table-query';
import type { CaseResponse } from './case-response.types';

/**
 * Một dòng danh sách/chi tiết vụ việc (nguồn `cases_garage`). Là `CaseResponse` cộng các số liệu
 * dẫn xuất từ cấn trừ, hóa đơn liên kết và lãi gộp. Không có `raw_data`; số tiền là number.
 */
export interface CaseListItem extends Omit<CaseResponse, 'services'> {
  category: { id: string; code: string | null; name: string | null } | null;
  /** Biên lợi nhuận (%), null khi chưa có doanh thu. */
  margin: number | null;
  /** Tổng đã chi (cấn trừ PAYMENT). */
  paidOutAmount: number;
  linkedInvoiceCount: number;
  linkedInvoiceOutCount: number;
  linkedInvoiceInCount: number;
  /** Phiếu OJ: đã gắn hóa đơn đầu ra còn hiệu lực hay chưa. `null` khi không phải OJ. */
  ojHasInvoice: boolean | null;
}

export interface CaseListResponse {
  items: CaseListItem[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}
