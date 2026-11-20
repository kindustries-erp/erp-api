import type { CaseDrillFilters } from './case-dashboard.sql';

/** Tham số của danh sách xe (drill-down): bộ lọc chung và phân trang theo xe. */
export interface CaseDashboardListParams extends CaseDrillFilters {
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Chuẩn hóa phân trang: trang >= 1, cỡ trang trong [1, 100]. */
export function normalizePaging(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const raw = Number.isFinite(pageSize)
    ? Math.floor(pageSize)
    : DEFAULT_PAGE_SIZE;
  const safeSize = Math.min(Math.max(raw, 1), MAX_PAGE_SIZE);
  return { page: safePage, pageSize: safeSize };
}
