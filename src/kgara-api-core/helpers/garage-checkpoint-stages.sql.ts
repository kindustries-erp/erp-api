import {
  countVehiclesSql,
  vehicleKeySql,
  type VehiclePlateColumn,
} from '@/common/utils/vehicle-count-sql';
import { quotationStatusSql } from './kgara-case-filter.helper';

/** Một biểu thức SELECT của truy vấn giai đoạn checkpoint (alias là khóa trong kết quả). */
export interface CheckpointStageSelect {
  alias: string;
  expr: string;
}

/** Điều kiện giai đoạn phiếu tiếp nhận (không đổi nghiệp vụ so với bản V1 trước). */
export function checkpointStageConditions() {
  const openCase =
    '(c.ngay_hoan_thanh_cong_viec IS NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9))';
  const quotation = quotationStatusSql('c');
  return {
    intake: `((c.tinh_trang_dich_vu = 0 OR c.ten_tinh_trang_dich_vu ILIKE '%tiếp nhận%') AND ${openCase})`,
    quotation: `${openCase} AND ${quotation}`,
    inProgress: `(${openCase} AND NOT (${quotation}))`,
    completed:
      '(c.ngay_hoan_thanh_cong_viec IS NOT NULL AND (c.tinh_trang_dich_vu IS NULL OR c.tinh_trang_dich_vu != 9))',
    cancelled: 'c.tinh_trang_dich_vu = 9',
  };
}

/** Bốn phân loại xe ERP, dùng cho cả tổng và từng giai đoạn. */
const CLASSES: ReadonlyArray<{ name: string; cond: string }> = [
  { name: 'SuaChua', cond: "c.classification = 'SUA_CHUA_CHUNG'" },
  { name: 'KyGui', cond: "c.classification = 'KY_GUI_NOI_BO'" },
  { name: 'Oj', cond: "c.classification IN ('OJ', 'OJ_NGOAI')" },
  {
    name: 'Khac',
    cond: "(c.classification IS NULL OR c.classification NOT IN ('SUA_CHUA_CHUNG', 'KY_GUI_NOI_BO', 'OJ', 'OJ_NGOAI'))",
  },
];

/**
 * Danh sách SELECT cho thống kê giai đoạn trong một kỳ.
 * Số lượng là SỐ XE (distinct biển số đã chuẩn hóa); `totalCases` là số phiếu.
 * Tiền (`*Amount`) vẫn cộng theo phiếu.
 */
export function buildCheckpointStageSelects(
  plateColumn: VehiclePlateColumn = 'bien_so_xe',
): CheckpointStageSelect[] {
  const key = vehicleKeySql('c', plateColumn);
  const s = checkpointStageConditions();
  const money = (cond: string) =>
    `SUM(CASE WHEN ${cond} THEN COALESCE(c.tien_co_thue, 0) ELSE 0 END)`;

  const selects: CheckpointStageSelect[] = [
    { alias: 'totalCases', expr: 'COUNT(c.id)' },
    { alias: 'totalIntake', expr: countVehiclesSql(key) },
    { alias: 'intakeCount', expr: countVehiclesSql(key, s.intake) },
    { alias: 'quotationCount', expr: countVehiclesSql(key, s.quotation) },
    { alias: 'inProgressCount', expr: countVehiclesSql(key, s.inProgress) },
    { alias: 'completedCount', expr: countVehiclesSql(key, s.completed) },
    { alias: 'cancelledCount', expr: countVehiclesSql(key, s.cancelled) },
    { alias: 'intakeAmount', expr: money(s.intake) },
    { alias: 'quotationAmount', expr: money(s.quotation) },
    { alias: 'inProgressAmount', expr: money(s.inProgress) },
    { alias: 'completedAmount', expr: money(s.completed) },
  ];

  for (const cls of CLASSES) {
    selects.push({
      alias: `total${cls.name}`,
      expr: countVehiclesSql(key, cls.cond),
    });
  }

  const stages = [
    { prefix: 'intake', cond: s.intake },
    { prefix: 'quotation', cond: s.quotation },
    { prefix: 'inProgress', cond: s.inProgress },
    { prefix: 'completed', cond: s.completed },
  ];
  for (const stage of stages) {
    for (const cls of CLASSES) {
      selects.push({
        alias: `${stage.prefix}${cls.name}`,
        expr: countVehiclesSql(key, `${stage.cond} AND ${cls.cond}`),
      });
    }
  }
  return selects;
}
