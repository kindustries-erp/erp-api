import { CaseStatus } from '../../cases-garage/entities/case-garage.enums';

/**
 * Giai đoạn checkpoint của dashboard garage V2.
 * Ánh xạ 1-1 từ `CaseStatus` của `cases_garage` (không dùng ILIKE như V1).
 */
export const CASE_DASHBOARD_STAGES = [
  'intake',
  'quotation',
  'inProgress',
  'completed',
  'cancelled',
] as const;
export type CaseDashboardStage = (typeof CASE_DASHBOARD_STAGES)[number];

/** Giai đoạn hiển thị trên phễu (không gồm tiếp nhận riêng). */
export const CASE_DASHBOARD_FUNNEL_STAGES = [
  'quotation',
  'inProgress',
  'completed',
  'cancelled',
] as const;
export type CaseDashboardFunnelStage =
  (typeof CASE_DASHBOARD_FUNNEL_STAGES)[number];

/** Bốn nhóm phân loại ERP dùng cho dashboard. */
export const CASE_DASHBOARD_CLASSES = [
  'SUA_CHUA_CHUNG',
  'KY_GUI_NOI_BO',
  'OJ_NGOAI',
  'KHAC',
] as const;
export type CaseDashboardClass = (typeof CASE_DASHBOARD_CLASSES)[number];

/** Giai đoạn → trạng thái `cases_garage` tương ứng (nguồn duy nhất cho truy vấn). */
export const CASE_DASHBOARD_STAGE_STATUS: Record<
  CaseDashboardStage,
  CaseStatus
> = {
  intake: CaseStatus.INTAKE,
  quotation: CaseStatus.QUOTED,
  inProgress: CaseStatus.IN_PROGRESS,
  completed: CaseStatus.COMPLETED,
  cancelled: CaseStatus.CANCELLED,
};

/** Số liệu một giai đoạn/phân loại: số XE (distinct biển), số lệnh và tiền (cộng theo lệnh). */
export interface CaseDashboardCountDto {
  vehicles: number;
  cases: number;
  amount: number;
}

/** KPI theo kỳ (tháng/tuần/ngày). `totalVehicles` là số xe khác nhau trong kỳ. */
export interface CaseDashboardPeriodKpiDto {
  totalVehicles: number;
  totalCases: number;
  revenue: number;
  cost: number;
  profit: number;
  totalAmountWithTax: number;
  paidAmount: number;
  outstandingAmount: number;
  collectionRate: number;
  stages: Record<CaseDashboardStage, CaseDashboardCountDto>;
  classifications: Record<CaseDashboardClass, CaseDashboardCountDto>;
}

/** Một giai đoạn của phễu: số xe, tiền và tỷ lệ so với tổng nhóm. */
export interface CaseDashboardFunnelStageDto {
  vehicles: number;
  amount: number;
  rate: number;
}

/** Một nhóm phễu (toàn kỳ, một tháng, hoặc một phân loại). */
export interface CaseDashboardFunnelBucketDto {
  totalVehicles: number;
  totalCases: number;
  totalAmount: number;
  stages: Record<CaseDashboardFunnelStage, CaseDashboardFunnelStageDto>;
}

/** Phễu đầy đủ: tổng toàn kỳ, theo tháng và theo phân loại. */
export interface CaseDashboardFunnelDto {
  overall: CaseDashboardFunnelBucketDto;
  byMonth: Record<string, CaseDashboardFunnelBucketDto>;
  byClassification: Record<CaseDashboardClass, CaseDashboardFunnelBucketDto>;
}

/** Một dòng trong drill-down danh sách lệnh của dashboard. */
export interface CaseDashboardCaseItemDto {
  id: string;
  caseCode: string;
  licensePlate: string | null;
  vehicleKey: string;
  customerName: string | null;
  /** Tên khách in trên phiếu KGara (có thể khác `customerName`). */
  voucherCustomerName: string | null;
  status: CaseStatus;
  stage: CaseDashboardStage;
  classification: CaseDashboardClass;
  receivedAt: string | null;
  completedAt: string | null;
  amount: number;
}

/**
 * Một dòng drill-down theo XE: gom các lệnh cùng khóa xe trong kỳ/bộ lọc.
 * `cases` là các lệnh của xe (mới nhất trước), `amount` cộng theo lệnh.
 */
export interface CaseDashboardVehicleItemDto {
  vehicleKey: string;
  licensePlate: string | null;
  customerName: string | null;
  voucherCustomerName: string | null;
  caseCount: number;
  caseCodes: string[];
  amount: number;
  /** Mốc mới nhất trong các lệnh (hoàn thành, nếu không có thì tiếp nhận). */
  latestAt: string | null;
  cases: CaseDashboardCaseItemDto[];
}

/** Số thô từ truy vấn (pg có thể trả chuỗi cho numeric/bigint). */
export interface CaseDashboardCountRaw {
  vehicles?: unknown;
  cases?: unknown;
  amount?: unknown;
}

export interface CaseDashboardPeriodRaw {
  totalVehicles?: unknown;
  totalCases?: unknown;
  revenue?: unknown;
  cost?: unknown;
  profit?: unknown;
  totalAmountWithTax?: unknown;
  paidAmount?: unknown;
  outstandingAmount?: unknown;
  stages?: Partial<Record<CaseDashboardStage, CaseDashboardCountRaw>>;
  classifications?: Partial<Record<CaseDashboardClass, CaseDashboardCountRaw>>;
}

export interface CaseDashboardFunnelBucketRaw {
  totalVehicles?: unknown;
  totalCases?: unknown;
  totalAmount?: unknown;
  stages?: Partial<
    Record<CaseDashboardFunnelStage, { vehicles?: unknown; amount?: unknown }>
  >;
}

export interface CaseDashboardFunnelRaw {
  overall: CaseDashboardFunnelBucketRaw;
  byMonth: Record<string, CaseDashboardFunnelBucketRaw>;
  byClassification: Partial<
    Record<CaseDashboardClass, CaseDashboardFunnelBucketRaw>
  >;
}

/** Dự thu/đang làm: xe và tiền của các lệnh chưa hoàn thành, không hủy (trạng thái INTAKE/QUOTED/IN_PROGRESS). */
export interface CaseDashboardProjectedDto {
  totalVehicles: number;
  totalAmount: number;
  classifications: Record<
    CaseDashboardClass,
    { vehicles: number; amount: number }
  >;
}

export interface CaseDashboardProjectedRaw {
  totalVehicles?: unknown;
  totalAmount?: unknown;
  classifications?: Partial<
    Record<CaseDashboardClass, { vehicles?: unknown; amount?: unknown }>
  >;
}

/** KPI tháng/tuần/ngày và dự thu quanh một ngày gốc. */
export interface CaseDashboardPeriodKpis {
  month: CaseDashboardPeriodKpiDto;
  week: CaseDashboardPeriodKpiDto;
  day: CaseDashboardPeriodKpiDto;
  projectedToday: CaseDashboardProjectedDto;
  projectedMonth: CaseDashboardProjectedDto;
}

/** Phản hồi `GET /overview`: KPI kỳ và phễu trong một lần gọi (dữ liệu không đổi khi đổi trang drill-down). */
export interface CaseDashboardOverviewDto {
  period: CaseDashboardPeriodKpis;
  funnel: CaseDashboardFunnelDto;
}
