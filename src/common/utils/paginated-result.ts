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
  /** Dữ liệu phụ của cả danh sách (không thuộc từng dòng), ví dụ `unreadCount`. Chỉ có khi được truyền. */
  extraData?: Record<string, unknown>;
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

/** Response danh sách không có `summaries`: `items` và `pagination` (kèm `extraData` khi cần). */
export type PagedList<T> = { items: T[]; pagination: PaginationMeta };

/**
 * Gom `items` và `pagination`. Truyền `extraData` khi danh sách có dữ liệu phụ chung
 * (ví dụ `{ unreadCount }`); không truyền thì response không có key `extraData`.
 */
export function toPagedList<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PagedList<T>;
export function toPagedList<T, E extends Record<string, unknown>>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  extraData: E,
): PagedList<T> & { extraData: E };
export function toPagedList<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  extraData?: Record<string, unknown>,
): PagedList<T> & { extraData?: Record<string, unknown> } {
  const result: PagedList<T> = {
    items,
    pagination: buildPagination(page, pageSize, total),
  };
  return extraData ? { ...result, extraData } : result;
}

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
  extraData?: Record<string, unknown>,
): PaginatedResult<T, S> => ({
  items,
  pagination: buildPagination(page, pageSize, total),
  summaries,
  ...(extraData ? { extraData } : {}),
});
