import {
  countVehiclesSql,
  vehicleKeySql,
} from '@/common/utils/vehicle-count-sql';
import { checkpointStageConditions } from './garage-checkpoint-stages.sql';

/** Một biểu thức SELECT của phễu dashboard garage (alias là khóa trong kết quả). */
export interface GarageFunnelSelect {
  alias: string;
  expr: string;
}

/** Tháng phát sinh của phiếu (YYYY-MM), dùng để nhóm phễu theo tháng. */
export const GARAGE_FUNNEL_MONTH_SQL =
  "TO_CHAR(COALESCE(c.ngay_hoan_thanh_cong_viec, c.ngay_phat_sinh, c.created_at), 'YYYY-MM')";

/** Phân loại ERP rút gọn cho phễu (4 nhóm). */
export const GARAGE_FUNNEL_CLASSIFICATION_KEY_SQL = `CASE
  WHEN c.classification = 'SUA_CHUA_CHUNG' THEN 'SUA_CHUA_CHUNG'
  WHEN c.classification IN ('KY_GUI_NOI_BO', 'KY_GUI', 'NOI_BO') THEN 'KY_GUI_NOI_BO'
  WHEN c.classification IN ('OJ', 'OJ_NGOAI') THEN 'OJ_NGOAI'
  ELSE 'KHAC'
END`;

/**
 * Danh sách SELECT của phễu dashboard garage.
 * Số lượng là SỐ XE (distinct biển số đã chuẩn hóa) trong nhóm; `totalCases` là số phiếu.
 * Tiền (`*Amount`) vẫn cộng theo phiếu.
 * Điều kiện giai đoạn dùng chung với checkpoint (`checkpointStageConditions`).
 */
export function buildGarageFunnelSelects(): GarageFunnelSelect[] {
  const key = vehicleKeySql('c', 'bien_so_xe');
  const s = checkpointStageConditions();
  const money = (cond: string) =>
    `SUM(CASE WHEN ${cond} THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)`;

  return [
    { alias: 'totalCases', expr: 'COUNT(c.id)' },
    { alias: 'totalCount', expr: countVehiclesSql(key) },
    {
      alias: 'totalAmount',
      expr: 'SUM(COALESCE(c.tien_co_thue, 0))',
    },
    {
      alias: 'quotationCount',
      expr: countVehiclesSql(key, s.quotation),
    },
    { alias: 'quotationAmount', expr: money(s.quotation) },
    {
      alias: 'inProgressCount',
      expr: countVehiclesSql(key, s.inProgress),
    },
    { alias: 'inProgressAmount', expr: money(s.inProgress) },
    {
      alias: 'completedCount',
      expr: countVehiclesSql(key, s.completed),
    },
    { alias: 'completedAmount', expr: money(s.completed) },
    {
      alias: 'cancelledCount',
      expr: countVehiclesSql(key, s.cancelled),
    },
    { alias: 'cancelledAmount', expr: money(s.cancelled) },
  ];
}

/** Số XE trong nhóm (distinct biển số chuẩn hóa), dùng chung cho dashboard garage. */
export const GARAGE_VEHICLE_COUNT_SQL = countVehiclesSql(
  vehicleKeySql('c', 'bien_so_xe'),
);

/**
 * Cách nhóm phễu:
 * - `none`: một dòng toàn kỳ (tổng distinct, không cộng dồn qua tháng/phân loại);
 * - `month`: theo tháng; `class`: theo phân loại toàn kỳ; `month-class`: theo cả hai.
 */
export type GarageFunnelGroup = 'none' | 'month' | 'class' | 'month-class';

/** Khóa nhóm của phễu theo cách nhóm (rỗng với `none`). */
export function garageFunnelGroupKeys(
  group: GarageFunnelGroup,
): GarageFunnelSelect[] {
  const month = { alias: 'month', expr: GARAGE_FUNNEL_MONTH_SQL };
  const cls = {
    alias: 'classificationKey',
    expr: GARAGE_FUNNEL_CLASSIFICATION_KEY_SQL,
  };
  switch (group) {
    case 'month':
      return [month];
    case 'class':
      return [cls];
    case 'month-class':
      return [month, cls];
    default:
      return [];
  }
}
