import { vehicleKey } from '@/common/utils/vehicle-count-sql';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_FUNNEL_STAGES,
  CASE_DASHBOARD_STAGES,
  CASE_DASHBOARD_STAGE_STATUS,
  type CaseDashboardCaseItemDto,
  type CaseDashboardClass,
  type CaseDashboardCountDto,
  type CaseDashboardCountRaw,
  type CaseDashboardFunnelBucketDto,
  type CaseDashboardFunnelBucketRaw,
  type CaseDashboardFunnelDto,
  type CaseDashboardFunnelRaw,
  type CaseDashboardFunnelStage,
  type CaseDashboardFunnelStageDto,
  type CaseDashboardPeriodKpiDto,
  type CaseDashboardPeriodRaw,
  type CaseDashboardProjectedDto,
  type CaseDashboardProjectedRaw,
  type CaseDashboardStage,
} from '../dto/case-dashboard.types';
import type { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import type { CaseStatus } from '../../cases-garage/entities/case-garage.enums';

/** Chuỗi/số từ DB → số hữu hạn (không hợp lệ thì 0). */
export const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Phần trăm một chữ số thập phân; mẫu 0 trả 0. */
export const percentOf = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** Giai đoạn từ trạng thái `cases_garage`. */
export function stageOfStatus(status: CaseStatus): CaseDashboardStage {
  const found = CASE_DASHBOARD_STAGES.find(
    (stage) => CASE_DASHBOARD_STAGE_STATUS[stage] === status,
  );
  return found ?? 'intake';
}

/**
 * Phân loại ERP từ cột `classification`.
 * Cùng quy tắc với V1 (`SUA_CHUA_CHUNG`; `KY_GUI_NOI_BO`/`KY_GUI`/`NOI_BO`; `OJ`/`OJ_NGOAI`), còn lại là KHAC.
 */
export function classOfCase(
  classification: string | null | undefined,
): CaseDashboardClass {
  const code = (classification ?? '').trim().toUpperCase();
  if (code === 'SUA_CHUA_CHUNG') return 'SUA_CHUA_CHUNG';
  if (['KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO'].includes(code)) {
    return 'KY_GUI_NOI_BO';
  }
  if (['OJ', 'OJ_NGOAI'].includes(code)) return 'OJ_NGOAI';
  return 'KHAC';
}

const toCountDto = (raw?: CaseDashboardCountRaw): CaseDashboardCountDto => ({
  vehicles: toNumber(raw?.vehicles),
  cases: toNumber(raw?.cases),
  amount: toNumber(raw?.amount),
});

const emptyCount = (): CaseDashboardCountDto => ({
  vehicles: 0,
  cases: 0,
  amount: 0,
});

/** KPI một kỳ: số xe/lệnh/tiền, tỷ lệ thu, và số theo giai đoạn/phân loại. */
export function toPeriodKpiDto(
  raw: CaseDashboardPeriodRaw,
): CaseDashboardPeriodKpiDto {
  const totalAmountWithTax = toNumber(raw.totalAmountWithTax);
  const paidAmount = toNumber(raw.paidAmount);

  const stages = {} as Record<CaseDashboardStage, CaseDashboardCountDto>;
  for (const stage of CASE_DASHBOARD_STAGES) {
    stages[stage] = toCountDto(raw.stages?.[stage]);
  }
  const classifications = {} as Record<
    CaseDashboardClass,
    CaseDashboardCountDto
  >;
  for (const cls of CASE_DASHBOARD_CLASSES) {
    classifications[cls] = raw.classifications?.[cls]
      ? toCountDto(raw.classifications[cls])
      : emptyCount();
  }

  return {
    totalVehicles: toNumber(raw.totalVehicles),
    totalCases: toNumber(raw.totalCases),
    revenue: toNumber(raw.revenue),
    cost: toNumber(raw.cost),
    profit: toNumber(raw.profit),
    totalAmountWithTax,
    paidAmount,
    outstandingAmount: toNumber(raw.outstandingAmount),
    collectionRate: percentOf(paidAmount, totalAmountWithTax),
    stages,
    classifications,
  };
}

const toFunnelStage = (
  raw: { vehicles?: unknown; amount?: unknown } | undefined,
  base: number,
): CaseDashboardFunnelStageDto => {
  const vehicles = toNumber(raw?.vehicles);
  return {
    vehicles,
    amount: toNumber(raw?.amount),
    rate: percentOf(vehicles, base),
  };
};

/** Một nhóm phễu: tỷ lệ mỗi giai đoạn tính trên tổng xe của nhóm. */
export function toFunnelBucketDto(
  raw: CaseDashboardFunnelBucketRaw | undefined,
): CaseDashboardFunnelBucketDto {
  const totalVehicles = toNumber(raw?.totalVehicles);
  const stages = {} as Record<
    CaseDashboardFunnelStage,
    CaseDashboardFunnelStageDto
  >;
  for (const stage of CASE_DASHBOARD_FUNNEL_STAGES) {
    stages[stage] = toFunnelStage(raw?.stages?.[stage], totalVehicles);
  }
  return {
    totalVehicles,
    totalCases: toNumber(raw?.totalCases),
    totalAmount: toNumber(raw?.totalAmount),
    stages,
  };
}

/** Phễu đầy đủ từ kết quả truy vấn: tổng toàn kỳ, theo tháng, theo phân loại. */
export function toFunnelDto(
  raw: CaseDashboardFunnelRaw,
): CaseDashboardFunnelDto {
  const byMonth: Record<string, CaseDashboardFunnelBucketDto> = {};
  for (const [month, bucket] of Object.entries(raw.byMonth)) {
    byMonth[month] = toFunnelBucketDto(bucket);
  }
  const byClassification = {} as Record<
    CaseDashboardClass,
    CaseDashboardFunnelBucketDto
  >;
  for (const cls of CASE_DASHBOARD_CLASSES) {
    byClassification[cls] = toFunnelBucketDto(raw.byClassification[cls]);
  }
  return {
    overall: toFunnelBucketDto(raw.overall),
    byMonth,
    byClassification,
  };
}

const isoOrNull = (d: Date | null | undefined): string | null =>
  d ? d.toISOString() : null;

/** Dòng drill-down: một lệnh, kèm khóa xe và giai đoạn/phân loại đã quy đổi. */
export function toCaseDashboardItemDto(
  c: Pick<
    CaseGarage,
    | 'id'
    | 'caseCode'
    | 'licensePlate'
    | 'customerName'
    | 'status'
    | 'classification'
    | 'receivedAt'
    | 'completedAt'
    | 'totalAmountWithTax'
  >,
): CaseDashboardCaseItemDto {
  return {
    id: c.id,
    caseCode: c.caseCode,
    licensePlate: c.licensePlate,
    vehicleKey: vehicleKey(c.licensePlate, c.id),
    customerName: c.customerName,
    status: c.status,
    stage: stageOfStatus(c.status),
    classification: classOfCase(c.classification),
    receivedAt: isoOrNull(c.receivedAt),
    completedAt: isoOrNull(c.completedAt),
    amount: toNumber(c.totalAmountWithTax),
  };
}

/** Dự thu/đang làm theo phân loại (số xe và tiền theo lệnh). */
export function toProjectedDto(
  raw: CaseDashboardProjectedRaw,
): CaseDashboardProjectedDto {
  const classifications = {} as CaseDashboardProjectedDto['classifications'];
  for (const cls of CASE_DASHBOARD_CLASSES) {
    classifications[cls] = {
      vehicles: toNumber(raw.classifications?.[cls]?.vehicles),
      amount: toNumber(raw.classifications?.[cls]?.amount),
    };
  }
  return {
    totalVehicles: toNumber(raw.totalVehicles),
    totalAmount: toNumber(raw.totalAmount),
    classifications,
  };
}
