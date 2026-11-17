import type { PaginationMeta } from '@/common/utils/paginated-result';
import type { SummaryMetric } from '@/common/utils/table-query';

/** Tham số list công nợ (chuỗi JSON đúng như query string của bảng V2). */
export interface DebtListQuery {
  page?: number | string;
  pageSize?: number | string;
  search?: string;
  summary_keys?: string;
  column_filters?: unknown;
  column_search?: unknown;
  column_operators?: unknown;
  date_ranges?: unknown;
  sort?: string;
}

export interface DebtListResult<T> {
  items: T[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}
