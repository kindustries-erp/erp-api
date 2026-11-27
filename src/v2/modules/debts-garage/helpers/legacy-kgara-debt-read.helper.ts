import type { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { caseInErpBranchSql } from './erp-branch-case.sql';
import {
  agingSumColumns,
  COMPLETED_CASE_CONDITIONS,
  PAYABLE_EXPRS as P,
  SUPPLIER_CASE_CONDITIONS,
} from './garage-debt-sql.helper';
import type { LedgerReadScope } from './ledger-read.helper';

/*
 * Lớp đọc công nợ v2 CŨ, tính lại từ bảng V1 `kgara_*` (giống V1 `/greenway`).
 *
 * Từ 2026-11-28 bỏ cờ `DEBTS_GARAGE_LEDGER_READ`: `customers`/`suppliers` luôn đọc sổ nợ `debts_garage`
 * (`buildCustomerLedgerQuery` / `buildSupplierLedgerQuery` trong `ledger-read.helper.ts`).
 * Trước khi bỏ cờ đã đối soát production: phải thu 738,826,690, phải trả 1,368,956,618 / đã trả 569,993,353 /
 * còn 804,606,625, `MISMATCH 0`; so 2 trang khi cờ tắt và bật khớp 100% (142, 44, 128 dòng). Story KINDU-2200.
 *
 * Không nơi nào gọi các hàm dưới đây. Giữ lại để quay về nhanh khi sổ nợ có sự cố:
 * trong `customer-debt-query.service.ts` / `supplier-debt-query.service.ts`, đổi lời gọi
 * `buildCustomerLedgerQuery` → `buildLegacyCustomerDebtQuery` (hoặc `buildSupplierLedgerQuery` →
 * `buildLegacySupplierDebtQuery`), cùng tham số. Cột trả về (`g.*`) giống hệt nhánh sổ nợ.
 */

const CUSTOMER_PLATE = `COALESCE(TRIM(c.bien_so_xe), '')`;
const SUPPLIER_PLATE = `COALESCE(TRIM(${P.plateRaw}), '')`;

/**
 * @deprecated Từ 2026-11-28 đọc sổ nợ (`buildCustomerLedgerQuery`). Chỉ dùng để quay về khi sổ nợ có sự cố.
 * Phải thu khách hàng từ `kgara_cases`, gom theo biển số. `scope.from` đã kẹp theo mốc theo dõi.
 */
export function buildLegacyCustomerDebtQuery(
  ds: DataSource,
  scope: LedgerReadScope,
): SelectQueryBuilder<ObjectLiteral> {
  const { branchId, from, to } = scope;
  return ds.createQueryBuilder().from((sub) => {
    sub
      .select(CUSTOMER_PLATE, 'bien_so_xe')
      .addSelect(`MAX(COALESCE(c.khach_hang_code, ''))`, 'khach_hang_code')
      .addSelect(
        `MAX(COALESCE(c.khach_hang_name, 'Chưa xác định'))`,
        'khach_hang_name',
      )
      .addSelect('MAX(c.branch_external_id)', 'branch_external_id')
      .addSelect('COUNT(c.id)::int', 'so_phieu')
      .addSelect('COALESCE(SUM(c.tien_co_thue), 0)::numeric', 'tong_doanh_thu')
      .addSelect(
        'COALESCE(SUM(c.tien_da_thanh_toan), 0)::numeric',
        'da_thanh_toan',
      )
      .addSelect(
        'COALESCE(SUM(c.tien_con_phai_thanh_toan), 0)::numeric',
        'con_phai_thu',
      )
      .addSelect('MAX(c.ngay_hoan_thanh_cong_viec)', 'ngay_gan_nhat')
      .addSelect('MIN(c.ngay_hoan_thanh_cong_viec)', 'ngay_xa_nhat')
      .addSelect(
        'COALESCE(MAX(CASE WHEN COALESCE(c.tien_con_phai_thanh_toan, 0) > 0 THEN CURRENT_DATE - DATE(c.ngay_hoan_thanh_cong_viec) ELSE 0 END), 0)::int',
        'max_aging_days',
      )
      .addSelect(
        agingSumColumns(
          'c.tien_con_phai_thanh_toan',
          'c.ngay_hoan_thanh_cong_viec',
        ),
      )
      .from('kgara_cases', 'c')
      .where(COMPLETED_CASE_CONDITIONS.join(' AND '))
      .andWhere('c.ngay_hoan_thanh_cong_viec >= :debtFrom', { debtFrom: from })
      .groupBy(CUSTOMER_PLATE);
    if (branchId) {
      sub.andWhere(caseInErpBranchSql('c', ':debtBranch'), {
        debtBranch: branchId,
      });
    }
    if (to) {
      sub.andWhere('c.ngay_hoan_thanh_cong_viec <= :debtTo', {
        debtTo: to.length === 10 ? `${to} 23:59:59.999` : to,
      });
    }
    return sub;
  }, 'g');
}

/**
 * @deprecated Từ 2026-11-28 đọc sổ nợ (`buildSupplierLedgerQuery`). Chỉ dùng để quay về khi sổ nợ có sự cố.
 * Phải trả từ phiếu đã Kết thúc + lãi gộp + PAYMENT, gom theo biển số (chỉ vụ chi phí > 0).
 */
export function buildLegacySupplierDebtQuery(
  ds: DataSource,
  scope: LedgerReadScope,
): SelectQueryBuilder<ObjectLiteral> {
  const { branchId, from, to } = scope;
  return ds.createQueryBuilder().from((sub) => {
    sub
      .select(SUPPLIER_PLATE, 'license_plate')
      .addSelect(
        `MAX(COALESCE(c.khach_hang_code, gp.raw_data->>'MaKhachHang', gp.ten_khach_hang, ''))`,
        'customer_code',
      )
      .addSelect(
        `MAX(COALESCE(c.khach_hang_name, gp.ten_khach_hang, 'Chưa xác định'))`,
        'customer_name',
      )
      .addSelect(
        `MAX(COALESCE(c.branch_external_id, gp.branch_external_id, ''))`,
        'branch_external_id',
      )
      .addSelect(`COUNT(DISTINCT ${P.caseCode})::int`, 'case_count')
      .addSelect(`COUNT(DISTINCT ${P.plateRaw})::int`, 'vehicle_count')
      .addSelect(`COALESCE(SUM(${P.cost}), 0)::numeric`, 'cost_amount')
      .addSelect(`COALESCE(SUM(${P.paid}), 0)::numeric`, 'paid_amount')
      .addSelect(`COALESCE(SUM(${P.balance}), 0)::numeric`, 'balance_amount')
      .addSelect(`MAX(${P.date})`, 'latest_date')
      .addSelect(`MIN(${P.date})`, 'oldest_date')
      .addSelect(
        `COALESCE(MAX(CURRENT_DATE - DATE(${P.date})), 0)::int`,
        'max_aging_days',
      )
      .addSelect(agingSumColumns(P.balance, P.date))
      .from('kgara_cases', 'c')
      .leftJoin('kgara_gross_profit', 'gp', 'gp.vu_viec_code = c.so_chung_tu')
      .leftJoin(
        (pay) =>
          pay
            .select('s.case_id', 'case_id')
            .addSelect('SUM(s.amount)::numeric', 'paid')
            .from('kgara_case_settlements', 's')
            .where("s.settlement_type = 'PAYMENT' AND s.case_id IS NOT NULL")
            .groupBy('s.case_id'),
        'pay',
        'pay.case_id = c.id',
      )
      .where(SUPPLIER_CASE_CONDITIONS.join(' AND '))
      .andWhere(P.hasPayable)
      .andWhere(`${P.date} >= :debtFrom`, { debtFrom: from })
      .groupBy(SUPPLIER_PLATE);
    if (branchId) {
      sub.andWhere(caseInErpBranchSql('c', ':debtBranch'), {
        debtBranch: branchId,
      });
    }
    if (to) {
      sub.andWhere(`${P.date} <= :debtTo`, {
        debtTo: to.length === 10 ? `${to} 23:59:59.999` : to,
      });
    }
    return sub;
  }, 'g');
}
