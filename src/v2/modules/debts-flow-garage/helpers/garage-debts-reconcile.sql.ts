import { buildPayableExprs } from '@/kgara-api-core/helpers/garage-payable-settlement.helper';
import {
  COMPLETED_CASE_CONDITIONS,
  PAYABLE_EXPRS as P2,
  PAYMENT_BY_CASE_JOIN as PAY_JOIN_V2,
  SUPPLIER_CASE_CONDITIONS,
} from '../../debts-garage/helpers/garage-debt-sql.helper';

/**
 * SQL đối soát công nợ garage theo từng vụ việc, ba nguồn: V1 (`/greenway`), v2 (`/api/v2/debts-garage`)
 * và sổ nợ `debts_garage`. Tham số `$1` = mốc bắt đầu (`GARAGE_DEBT_BASELINE_DATE`). Chỉ SELECT.
 *
 * Điều kiện V1 chép độc lập từ `kgara-customers-debt-query.service.ts` và
 * `kgara-suppliers-debt-query.engine.ts` (không import) để phát hiện khi V1 và v2 lệch nhau.
 */

/** Điều kiện vụ việc tính phải thu của V1 (bí danh `c`). */
const V1_RECEIVABLE_CONDITIONS = [
  'c.kgara_deleted_at IS NULL',
  'c.exclude_from_reports IS NOT TRUE',
  'c.exclude_from_debt IS NOT TRUE',
  "(c.tinh_trang_dich_vu = 3 OR c.ten_tinh_trang_dich_vu = 'Kết thúc' OR c.ten_tinh_trang_dich_vu ILIKE '%kết thúc%' OR c.ten_tinh_trang_dich_vu ILIKE '%hoàn tất%')",
  'c.ngay_hoan_thanh_cong_viec IS NOT NULL',
  'c.ngay_hoan_thanh_cong_viec >= $1',
];

const V1_COST = 'COALESCE("gp"."chi_phi", "c"."chi_phi", 0)::numeric';
const V1_DATE = `COALESCE("c"."ngay_hoan_thanh_cong_viec", ("gp"."raw_data"->>'NgayKetThuc')::timestamp, "c"."ngay_phat_sinh")`;
const V1_PAY = buildPayableExprs(V1_COST);

/** Điều kiện vụ việc tính phải trả của V1 (bí danh `c`, `gp`, `pay`). */
const V1_PAYABLE_CONDITIONS = [
  '"c"."id" IS NOT NULL',
  '"c"."tinh_trang_dich_vu" = 3',
  '"c"."kgara_deleted_at" IS NULL',
  '"c"."exclude_from_reports" IS NOT TRUE',
  '"c"."exclude_from_debt" IS NOT TRUE',
  V1_PAY.hasPayableCondition,
  `${V1_DATE} >= $1`,
];

const LEDGER_LIVE =
  "d.is_deleted = false AND d.status <> 'VOID' AND d.excluded = false AND d.due_base_date >= $1";

/** Mỗi dòng: một vụ việc, số còn phải thu ở V1, v2 và sổ nợ (thiếu ở nguồn nào thì NULL). */
export const RECEIVABLE_RECONCILE_SQL = `
WITH v1 AS (
  SELECT c.id::text AS case_id, COALESCE(c.tien_con_phai_thanh_toan, 0)::numeric AS bal
  FROM kgara_cases c WHERE ${V1_RECEIVABLE_CONDITIONS.join(' AND ')}
), v2 AS (
  SELECT c.id::text AS case_id, COALESCE(c.tien_con_phai_thanh_toan, 0)::numeric AS bal
  FROM kgara_cases c WHERE ${COMPLETED_CASE_CONDITIONS.join(' AND ')} AND c.ngay_hoan_thanh_cong_viec >= $1
), led AS (
  SELECT d.case_id::text AS case_id, SUM(d.balance_amount)::numeric AS bal
  FROM debts_garage d WHERE ${LEDGER_LIVE} AND d.direction = 'RECEIVABLE'
  GROUP BY d.case_id
), ids AS (SELECT case_id FROM v1 UNION SELECT case_id FROM v2 UNION SELECT case_id FROM led)
SELECT ids.case_id, k.so_chung_tu AS code, v1.bal AS v1_bal, v2.bal AS v2_bal, led.bal AS led_bal
FROM ids
LEFT JOIN v1 ON v1.case_id = ids.case_id
LEFT JOIN v2 ON v2.case_id = ids.case_id
LEFT JOIN led ON led.case_id = ids.case_id
LEFT JOIN kgara_cases k ON k.id::text = ids.case_id
ORDER BY k.so_chung_tu`;

/** Mỗi dòng: một vụ việc, chi phí / đã chi / còn phải trả ở V1, v2 và sổ nợ. */
export const PAYABLE_RECONCILE_SQL = `
WITH v1 AS (
  SELECT "c"."id"::text AS case_id, ${V1_COST} AS cost, ${V1_PAY.paidExpr} AS paid, ${V1_PAY.balanceExpr} AS bal
  FROM "kgara_cases" "c"
  FULL OUTER JOIN "kgara_gross_profit" "gp" ON "gp"."vu_viec_code" = "c"."so_chung_tu"
  LEFT JOIN (
    SELECT "case_id", SUM("amount")::numeric AS "paid" FROM "kgara_case_settlements"
    WHERE "settlement_type" = 'PAYMENT' AND "case_id" IS NOT NULL GROUP BY "case_id"
  ) "pay" ON "pay"."case_id" = "c"."id"
  WHERE ${V1_PAYABLE_CONDITIONS.join(' AND ')}
), v2 AS (
  SELECT c.id::text AS case_id, ${P2.cost} AS cost, ${P2.paid} AS paid, ${P2.balance} AS bal
  FROM kgara_cases c
  LEFT JOIN kgara_gross_profit gp ON gp.vu_viec_code = c.so_chung_tu
  ${PAY_JOIN_V2}
  WHERE ${SUPPLIER_CASE_CONDITIONS.join(' AND ')} AND ${P2.hasPayable} AND ${P2.date} >= $1
), led AS (
  SELECT d.case_id::text AS case_id, SUM(d.original_amount)::numeric AS cost,
         SUM(d.settled_amount)::numeric AS paid, SUM(d.balance_amount)::numeric AS bal
  FROM debts_garage d WHERE ${LEDGER_LIVE} AND d.direction = 'PAYABLE'
  GROUP BY d.case_id
), ids AS (SELECT case_id FROM v1 UNION SELECT case_id FROM v2 UNION SELECT case_id FROM led)
SELECT ids.case_id, k.so_chung_tu AS code,
       v1.cost AS v1_cost, v1.paid AS v1_paid, v1.bal AS v1_bal,
       v2.cost AS v2_cost, v2.paid AS v2_paid, v2.bal AS v2_bal,
       led.cost AS led_cost, led.paid AS led_paid, led.bal AS led_bal
FROM ids
LEFT JOIN v1 ON v1.case_id = ids.case_id
LEFT JOIN v2 ON v2.case_id = ids.case_id
LEFT JOIN led ON led.case_id = ids.case_id
LEFT JOIN kgara_cases k ON k.id::text = ids.case_id
ORDER BY k.so_chung_tu`;
