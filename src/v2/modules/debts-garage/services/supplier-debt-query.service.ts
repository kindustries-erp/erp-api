import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { TableColumnMap } from '@/common/utils/table-query';
import {
  AbstractDebtQueryService,
  type DebtListQuery,
} from '@/v2/core/debts-core';
import { SupplierDebtRow } from '../dto/supplier-debt-row.dto';
import { toSupplierDebtRow } from '../helpers/supplier-debt-row.mapper';
import {
  agingSumColumns,
  GARAGE_DEBT_BASELINE_DATE,
  PAYABLE_EXPRS as P,
  SUPPLIER_CASE_CONDITIONS,
} from '../helpers/garage-debt-sql.helper';

import {
  buildSupplierLedgerQuery,
  isLedgerReadEnabled,
} from '../helpers/ledger-read.helper';
import { caseInErpBranchSql } from '../helpers/erp-branch-case.sql';

export interface SupplierDebtListQuery extends DebtListQuery {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  from?: string;
  to?: string;
  scope?: 'outstanding' | 'all';
}

const col = (sql: string, type: 'text' | 'number' | 'date') => ({ sql, type });

const COLUMNS: TableColumnMap = {
  licensePlate: col('g.license_plate', 'text'),
  customerCode: col('g.customer_code', 'text'),
  customerName: col('g.customer_name', 'text'),
  branchExternalId: col('g.branch_external_id', 'text'),
  caseCount: col('g.case_count', 'number'),
  costAmount: col('g.cost_amount', 'number'),
  paidAmount: col('g.paid_amount', 'number'),
  balanceAmount: col('g.balance_amount', 'number'),
  latestDate: col('g.latest_date', 'date'),
  maxAgingDays: col('g.max_aging_days', 'number'),
  aging0_30: col('g.aging_0_30', 'number'),
  aging31_60: col('g.aging_31_60', 'number'),
  aging61_90: col('g.aging_61_90', 'number'),
  agingOver90: col('g.aging_over_90', 'number'),
};

/** Khóa gom: biển số đã trim; phiếu chưa có biển số gom chung vào chuỗi rỗng (lọc trống khớp, không lộ giá trị giả). */
const PLATE = `COALESCE(TRIM(${P.plateRaw}), '')`;

/**
 * Công nợ phải trả v2, gom theo biển số xe. Đi từ phiếu đã Kết thúc rồi LEFT JOIN lãi gộp theo mã
 * (V1 dùng FULL OUTER JOIN nhưng điều kiện `c.id IS NOT NULL` loại hết dòng chỉ có lãi gộp, nên kết quả như nhau).
 */
@Injectable()
export class SupplierDebtQueryService extends AbstractDebtQueryService<
  SupplierDebtRow,
  ObjectLiteral
> {
  protected readonly columns = COLUMNS;
  protected readonly summaryColumns = [
    { key: 'costAmount', sql: 'g.cost_amount' },
    { key: 'paidAmount', sql: 'g.paid_amount' },
    { key: 'balanceAmount', sql: 'g.balance_amount' },
    { key: 'aging0_30', sql: 'g.aging_0_30' },
    { key: 'aging31_60', sql: 'g.aging_31_60' },
    { key: 'aging61_90', sql: 'g.aging_61_90' },
    { key: 'agingOver90', sql: 'g.aging_over_90' },
  ];
  protected readonly searchColumns = [
    'g.customer_code',
    'g.customer_name',
    'g.license_plate',
  ];
  protected readonly defaultSort = {
    sql: 'g.balance_amount',
    direction: 'DESC' as const,
  };
  protected readonly tieBreaker = 'g.license_plate';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  protected createBaseQuery(
    query: DebtListQuery,
  ): SelectQueryBuilder<ObjectLiteral> {
    const { branchId, from, to, scope } = query as SupplierDebtListQuery;
    const effectiveFrom =
      from && from > GARAGE_DEBT_BASELINE_DATE
        ? from
        : GARAGE_DEBT_BASELINE_DATE;

    if (isLedgerReadEnabled()) {
      const ledger = buildSupplierLedgerQuery(this.dataSource, {
        branchId,
        from: effectiveFrom,
        to,
      });
      if (scope === 'outstanding') ledger.where('g.balance_amount > 0');
      return ledger;
    }

    const outer = this.dataSource.createQueryBuilder().from((sub) => {
      sub
        .select(PLATE, 'license_plate')
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
        .andWhere(`${P.date} >= :debtFrom`, { debtFrom: effectiveFrom })
        .groupBy(PLATE);
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

    if (scope === 'outstanding') outer.where('g.balance_amount > 0');
    return outer;
  }

  protected fetchPage(
    qb: SelectQueryBuilder<ObjectLiteral>,
    offset: number,
    limit: number,
  ): Promise<{ rows: SupplierDebtRow[]; total: number }> {
    return this.fetchRawPage(qb, offset, limit, toSupplierDebtRow);
  }
}
