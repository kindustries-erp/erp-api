/** Thông tin phân trang của một response danh sách (khớp chuẩn v2). */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Response danh sách chuẩn v2: `items`, `pagination` và `summaries` (tổng toàn bộ dòng khớp bộ lọc). */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
  summaries: Record<string, number>;
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
export const toPaginatedResult = <T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
  summaries: Record<string, number> = {},
): PaginatedResult<T> => ({
  items,
  pagination: buildPagination(page, pageSize, total),
  summaries,
});
