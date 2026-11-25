import type { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { agingSumColumns } from './garage-debt-sql.helper';
import { applyBranchScope } from '@/v2/core/branches-core';

/** Cờ đọc công nợ từ sổ nợ (`debts_garage`) thay vì tính từ `kgara_*`. Mặc định tắt; chỉ bật sau khi đối soát lệch = 0. */
export function isLedgerReadEnabled(): boolean {
  return process.env.DEBTS_GARAGE_LEDGER_READ === 'true';
}

export interface LedgerReadScope {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  /** Ngày mốc từ (đã kẹp theo mốc theo dõi). */
  from: string;
  to?: string;
}

/** Điều kiện chung của khoản nợ còn hiệu lực. Bí danh `d`. */
function ledgerWhere(
  sub: SelectQueryBuilder<ObjectLiteral>,
  direction: 'RECEIVABLE' | 'PAYABLE',
  scope: LedgerReadScope,
): void {
  sub
    .from('debts_garage', 'd')
    .where('d.is_deleted = false')
    .andWhere("d.status <> 'VOID'")
    .andWhere('d.excluded = false')
    .andWhere('d.direction = :ledgerDir', { ledgerDir: direction })
    .andWhere('d.due_base_date >= :ledgerFrom', { ledgerFrom: scope.from });
  applyBranchScope(sub, 'd', scope.branchId, 'ledgerBranch');
  if (scope.to) {
    sub.andWhere('d.due_base_date <= :ledgerTo', {
      ledgerTo: scope.to.slice(0, 10),
    });
  }
}

const PLATE = `COALESCE(TRIM(d.license_plate), '')`;

/** Truy vấn phải thu khách hàng từ sổ nợ, cùng tên cột (`g.*`) với truy vấn đọc từ `kgara_*`. */
export function buildCustomerLedgerQuery(
  ds: DataSource,
  scope: LedgerReadScope,
): SelectQueryBuilder<ObjectLiteral> {
  return ds.createQueryBuilder().from((sub) => {
    sub
      .select(PLATE, 'bien_so_xe')
      .addSelect(
        `COALESCE(MAX(CASE WHEN d.party_type = 'CUSTOMER' THEN d.party_code END), '')`,
        'khach_hang_code',
      )
      .addSelect(
        `COALESCE(MAX(CASE WHEN d.party_type = 'CUSTOMER' THEN d.party_name END), 'Chưa xác định')`,
        'khach_hang_name',
      )
      .addSelect('MAX(d.branch_external_id)', 'branch_external_id')
      .addSelect('COUNT(DISTINCT d.case_id)::int', 'so_phieu')
      .addSelect(
        'COALESCE(SUM(d.original_amount), 0)::numeric',
        'tong_doanh_thu',
      )
      .addSelect('COALESCE(SUM(d.settled_amount), 0)::numeric', 'da_thanh_toan')
      .addSelect('COALESCE(SUM(d.balance_amount), 0)::numeric', 'con_phai_thu')
      .addSelect('MAX(d.due_base_date)', 'ngay_gan_nhat')
      .addSelect('MIN(d.due_base_date)', 'ngay_xa_nhat')
      .addSelect(
        'COALESCE(MAX(CASE WHEN d.balance_amount > 0 THEN CURRENT_DATE - d.due_base_date ELSE 0 END), 0)::int',
        'max_aging_days',
      )
      .addSelect(agingSumColumns('d.balance_amount', 'd.due_base_date'));
    ledgerWhere(sub, 'RECEIVABLE', scope);
    return sub.groupBy(PLATE);
  }, 'g');
}

/** Truy vấn phải trả từ sổ nợ, cùng tên cột (`g.*`) với truy vấn đọc từ `kgara_*`. */
export function buildSupplierLedgerQuery(
  ds: DataSource,
  scope: LedgerReadScope,
): SelectQueryBuilder<ObjectLiteral> {
  return ds.createQueryBuilder().from((sub) => {
    sub
      .select(PLATE, 'license_plate')
      .addSelect(`MAX(COALESCE(c.khach_hang_code, ''))`, 'customer_code')
      .addSelect(
        `MAX(COALESCE(c.khach_hang_name, 'Chưa xác định'))`,
        'customer_name',
      )
      .addSelect('MAX(d.branch_external_id)', 'branch_external_id')
      .addSelect('COUNT(DISTINCT d.case_id)::int', 'case_count')
      .addSelect(`COUNT(DISTINCT ${PLATE})::int`, 'vehicle_count')
      .addSelect('COALESCE(SUM(d.original_amount), 0)::numeric', 'cost_amount')
      .addSelect('COALESCE(SUM(d.settled_amount), 0)::numeric', 'paid_amount')
      .addSelect(
        'COALESCE(SUM(d.balance_amount), 0)::numeric',
        'balance_amount',
      )
      .addSelect('MAX(d.due_base_date)', 'latest_date')
      .addSelect('MIN(d.due_base_date)', 'oldest_date')
      .addSelect(
        'COALESCE(MAX(CURRENT_DATE - d.due_base_date), 0)::int',
        'max_aging_days',
      )
      .addSelect(agingSumColumns('d.balance_amount', 'd.due_base_date'));
    ledgerWhere(sub, 'PAYABLE', scope);
    return sub.leftJoin('kgara_cases', 'c', 'c.id = d.case_id').groupBy(PLATE);
  }, 'g');
}
