import type { SelectQueryBuilder } from 'typeorm';
import {
  countVehiclesSql,
  vehicleKeySql,
} from '@/common/utils/vehicle-count-sql';
import type { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import {
  CASE_DASHBOARD_CLASSES,
  CASE_DASHBOARD_STAGES,
  CASE_DASHBOARD_STAGE_STATUS,
  type CaseDashboardClass,
  type CaseDashboardStage,
} from '../dto/case-dashboard.types';

/** Biểu thức SQL dùng chung cho dashboard garage V2 (KPI và phễu). Không nhận input người dùng. */

/** Khóa xe: biển số đã chuẩn hóa, phiếu không biển khóa theo id. */
export const VEHICLE_KEY = vehicleKeySql('c', 'license_plate');

/** Ngày xếp kỳ (checkpoint): hoàn thành, rồi phát sinh, rồi tạo. */
export const PERIOD_DATE =
  'COALESCE(c.completed_at, c.issued_at, c.created_at)';

/** Lọc chung: bỏ phiếu đã xóa mềm (v2 hoặc phía KGara) và phiếu loại khỏi báo cáo. */
export const BASE_FILTER =
  'c.is_deleted = false AND c.external_deleted_at IS NULL AND c.exclude_from_reports = false';

/** Điều kiện SQL theo giai đoạn, lấy từ hằng số (không nhận input người dùng). */
export const STAGE_SQL = Object.fromEntries(
  CASE_DASHBOARD_STAGES.map((stage) => [
    stage,
    `c.status = '${CASE_DASHBOARD_STAGE_STATUS[stage]}'`,
  ]),
) as Record<CaseDashboardStage, string>;

/** Điều kiện SQL theo phân loại, khớp `classOfCase` (trim + upper, cùng bảng gộp mã). */
export const CLASS_SQL: Record<CaseDashboardClass, string> = {
  SUA_CHUA_CHUNG: "UPPER(TRIM(c.classification)) = 'SUA_CHUA_CHUNG'",
  KY_GUI_NOI_BO:
    "UPPER(TRIM(c.classification)) IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO')",
  OJ_NGOAI: "UPPER(TRIM(c.classification)) IN ('OJ', 'OJ_NGOAI')",
  KHAC: "(c.classification IS NULL OR UPPER(TRIM(c.classification)) NOT IN ('SUA_CHUA_CHUNG', 'KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO', 'OJ', 'OJ_NGOAI'))",
};

/** Bộ lọc dùng chung của các truy vấn drill-down (theo lệnh và theo xe). */
export interface CaseDrillFilters {
  range: { start: Date; end: Date };
  stage?: CaseDashboardStage;
  classification?: CaseDashboardClass;
}

/** Áp lọc hợp lệ, khoảng ngày kỳ, giai đoạn và phân loại lên query builder `cases_garage` (alias `c`). */
export function applyCaseFilters(
  qb: SelectQueryBuilder<CaseGarage>,
  filters: CaseDrillFilters,
): SelectQueryBuilder<CaseGarage> {
  qb.where(BASE_FILTER).andWhere(
    `${PERIOD_DATE} >= :start AND ${PERIOD_DATE} <= :end`,
    { start: filters.range.start, end: filters.range.end },
  );
  if (filters.stage) {
    qb.andWhere('c.status = :status', {
      status: CASE_DASHBOARD_STAGE_STATUS[filters.stage],
    });
  }
  if (filters.classification) {
    qb.andWhere(CLASS_SQL[filters.classification]);
  }
  return qb;
}

export interface SelectPart {
  alias: string;
  expr: string;
}

/** Tên alias theo giai đoạn/phân loại, dùng lại khi đọc kết quả. */
export const stageAlias = (stage: CaseDashboardStage, metric: string) =>
  `stage_${stage}_${metric}`;
export const classAlias = (cls: CaseDashboardClass, metric: string) =>
  `class_${cls}_${metric}`;

/** Ghép biểu thức SELECT vào query builder (phần tử đầu dùng `select`, còn lại `addSelect`). */
export function applySelects(
  qb: SelectQueryBuilder<CaseGarage>,
  parts: SelectPart[],
): SelectQueryBuilder<CaseGarage> {
  parts.forEach((part, i) => {
    if (i === 0) qb.select(part.expr, part.alias);
    else qb.addSelect(part.expr, part.alias);
  });
  return qb;
}
