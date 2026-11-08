import type { SummaryMetric } from './table-query/table-query.summary';

/** Thông tin phân trang của một response danh sách (khớp chuẩn v2). */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Response danh sách chuẩn v2: `items`, `pagination` và `summaries`.
 * `summaries` mặc định theo `SummaryMetric` (total, pageSubtotal, cumulative) hoặc null; module cũ có thể truyền kiểu khác.
 */
export interface PaginatedResult<
  T,
  S extends Record<string, unknown> = Record<string, SummaryMetric | null>,
> {
  items: T[];
  pagination: PaginationMeta;
  summaries: S;
}

/** Tạo khối phân trang. `totalPages` tối thiểu bằng 1 kể cả khi không có dòng nào. */
export const buildPagination = (
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
});

/** Gom items đã map cùng phân trang và tổng thành response danh sách chuẩn v2. */
export const toPaginatedResult = <
  T,
  S extends Record<string, unknown> = Record<string, SummaryMetric | null>,
>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  summaries: S = {} as S,
): PaginatedResult<T, S> => ({
  items,
  pagination: buildPagination(page, pageSize, total),
  summaries,
});
