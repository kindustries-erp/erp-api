import type { SummaryMetric } from './table-query/table-query.summary';

/** Thông tin phân trang của một response danh sách (khớp chuẩn v2). */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Số trang kế tiếp, null khi đã ở trang cuối. */
  next: number | null;
  /** Số trang trước, null khi đang ở trang đầu. */
  previous: number | null;
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
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return {
    page,
    pageSize,
    total,
    totalPages,
    next: page < totalPages ? page + 1 : null,
    previous: page > 1 ? Math.min(page - 1, totalPages) : null,
  };
};

/** Response danh sách không có `summaries`: `items` và `pagination`. */
export type PagedList<T> = { items: T[]; pagination: PaginationMeta };

export const toPagedList = <T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PagedList<T> => ({
  items,
  pagination: buildPagination(page, pageSize, total),
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
