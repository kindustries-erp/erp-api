import { DEFAULT_AGING_BUCKETS } from '@/v2/core/debts-core';

/** Mốc bắt đầu theo dõi công nợ garage: từ 07/2026. Khớp V1 (`GARAGE_DEBT_BASELINE_DATE`). */
export const GARAGE_DEBT_BASELINE_DATE = '2026-07-01';

/** Tên cột SQL của từng mốc tuổi nợ, theo `DEFAULT_AGING_BUCKETS`. */
export const AGING_COLUMN_BY_BUCKET: Readonly<Record<string, string>> = {
  '0-30': 'aging_0_30',
  '31-60': 'aging_31_60',
  '61-90': 'aging_61_90',
  '>90': 'aging_over_90',
};

/** Vụ việc đã kết thúc, còn tính vào công nợ. Cùng điều kiện với V1; bí danh bảng là `c`. */
export const COMPLETED_CASE_CONDITIONS: ReadonlyArray<string> = [
  'c.kgara_deleted_at IS NULL',
  'c.exclude_from_reports IS NOT TRUE',
  'c.exclude_from_debt IS NOT TRUE',
  "(c.tinh_trang_dich_vu = 3 OR c.ten_tinh_trang_dich_vu = 'Kết thúc' OR c.ten_tinh_trang_dich_vu ILIKE '%kết thúc%' OR c.ten_tinh_trang_dich_vu ILIKE '%hoàn tất%')",
  'c.ngay_hoan_thanh_cong_viec IS NOT NULL',
];

/** Điều kiện số ngày cho mốc thứ `index` của `DEFAULT_AGING_BUCKETS`. */
function dayRange(index: number): string {
  const { maxDays } = DEFAULT_AGING_BUCKETS[index];
  const prev = index > 0 ? DEFAULT_AGING_BUCKETS[index - 1].maxDays : null;
  if (maxDays === null) return `> ${prev ?? 0}`;
  return prev === null ? `<= ${maxDays}` : `BETWEEN ${prev + 1} AND ${maxDays}`;
}

/**
 * Các cột SQL `SUM(...) AS aging_*`: số dư còn nợ theo mốc tuổi nợ.
 * `balanceSql` và `dateSql` là biểu thức cố định trong code, không nhận input.
 */
export function agingSumColumns(balanceSql: string, dateSql: string): string {
  return DEFAULT_AGING_BUCKETS.map((bucket, index) => {
    const alias = AGING_COLUMN_BY_BUCKET[bucket.key];
    return `COALESCE(SUM(CASE WHEN COALESCE(${balanceSql}, 0) > 0 AND (CURRENT_DATE - DATE(${dateSql})) ${dayRange(index)} THEN ${balanceSql} ELSE 0 END), 0)::numeric AS ${alias}`;
  }).join(',\n        ');
}

/** Phiếu đã Kết thúc (3), chưa xóa, còn tính công nợ. Bí danh bảng `c`. Khớp V1 phải trả. */
export const SUPPLIER_CASE_CONDITIONS: ReadonlyArray<string> = [
  'c.id IS NOT NULL',
  'c.tinh_trang_dich_vu = 3',
  'c.kgara_deleted_at IS NULL',
  'c.exclude_from_reports IS NOT TRUE',
  'c.exclude_from_debt IS NOT TRUE',
];

/** Biểu thức phải trả. Còn phải trả của MỘT vụ việc = max(0, chi phí - đã chi), không bù sang vụ khác. */
export const PAYABLE_EXPRS = (() => {
  const cost = 'COALESCE(gp.chi_phi, c.chi_phi, 0)::numeric';
  const paid = 'COALESCE(pay.paid, 0)::numeric';
  return {
    cost,
    paid,
    balance: `GREATEST(${cost} - ${paid}, 0)`,
    hasPayable: `(${cost} > 0 OR ${paid} <> 0)`,
    date: `COALESCE(c.ngay_hoan_thanh_cong_viec, (gp.raw_data->>'NgayKetThuc')::timestamp, c.ngay_phat_sinh)`,
    plateRaw: `COALESCE(c.bien_so_xe, substring(gp.vu_viec_name from 'Biển số: ([^ ]+)'))`,
    caseCode: 'COALESCE(c.so_chung_tu, gp.vu_viec_code)',
  };
})();

/** Join gộp tổng PAYMENT theo vụ việc (bí danh `pay`); gộp trước để không nhân dòng. Cần bí danh `c`. */
export const PAYMENT_BY_CASE_JOIN = `LEFT JOIN (
  SELECT case_id, SUM(amount)::numeric AS paid
  FROM kgara_case_settlements
  WHERE settlement_type = 'PAYMENT' AND case_id IS NOT NULL
  GROUP BY case_id
) pay ON pay.case_id = c.id`;

/** Cột `SUM(...)` số dư còn nợ của khoản có tuổi nợ <= `days` ngày. */
export function dueWithinDaysColumn(
  balanceSql: string,
  dateSql: string,
  days: number,
  alias: string,
): string {
  return `COALESCE(SUM(CASE WHEN COALESCE(${balanceSql}, 0) > 0 AND (CURRENT_DATE - DATE(${dateSql})) <= ${Math.trunc(days)} THEN ${balanceSql} ELSE 0 END), 0)::numeric AS ${alias}`;
}
