import type { PaginationMeta } from '@/common/utils/paginated-result';

/** Vụ việc khớp với một dòng lợi nhuận gộp (chỉ vụ việc đang hoạt động, khớp theo mã chứng từ). */
export interface GrossProfitCaseRef {
  id: string;
  caseCode: string;
  licensePlate: string | null;
  customerName: string | null;
  issuedAt: string | null;
  completedAt: string | null;
  statusName: string | null;
}

export interface GrossProfitReportItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  caseCode: string | null;
  caseName: string | null;
  customerName: string | null;
  revenue: number;
  cost: number;
  profit: number;
  /** Null khi chưa có vụ việc hoạt động cùng mã (dòng lợi nhuận gộp mồ côi). */
  case: GrossProfitCaseRef | null;
}

/** Response v2: danh sách phân trang; tổng toàn bộ tập lọc nằm trong `extraData.totals`. */
export interface GrossProfitReportResponse {
  items: GrossProfitReportItem[];
  pagination: PaginationMeta;
  extraData: {
    totals: { revenue: number; cost: number; profit: number; rowCount: number };
  };
}
