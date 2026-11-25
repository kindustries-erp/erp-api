import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { TableColumnMap } from '@/common/utils/table-query';
import {
  AbstractDebtQueryService,
  type DebtListQuery,
} from '@/v2/core/debts-core';
import { CustomerDebtRow } from '../dto/customer-debt-row.dto';
import { toCustomerDebtRow } from '../helpers/customer-debt-row.mapper';
import {
  agingSumColumns,
  COMPLETED_CASE_CONDITIONS,
  GARAGE_DEBT_BASELINE_DATE,
} from '../helpers/garage-debt-sql.helper';

import {
  buildCustomerLedgerQuery,
  isLedgerReadEnabled,
} from '../helpers/ledger-read.helper';
import { caseInErpBranchSql } from '../helpers/erp-branch-case.sql';

export interface CustomerDebtListQuery extends DebtListQuery {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  /** Ngày hoàn thành từ (YYYY-MM-DD); không sớm hơn mốc theo dõi. */
  from?: string;
  to?: string;
  scope?: 'outstanding' | 'all';
}

const col = (sql: string, type: 'text' | 'number' | 'date') => ({ sql, type });

/** Cột của truy vấn đã gom (bí danh `g`). Không có cột nào lấy SQL từ input. */
const COLUMNS: TableColumnMap = {
  licensePlate: col('g.bien_so_xe', 'text'),
  customerCode: col('g.khach_hang_code', 'text'),
  customerName: col('g.khach_hang_name', 'text'),
  branchExternalId: col('g.branch_external_id', 'text'),
  caseCount: col('g.so_phieu', 'number'),
  totalAmount: col('g.tong_doanh_thu', 'number'),
  paidAmount: col('g.da_thanh_toan', 'number'),
  balanceAmount: col('g.con_phai_thu', 'number'),
  latestDate: col('g.ngay_gan_nhat', 'date'),
  maxAgingDays: col('g.max_aging_days', 'number'),
  aging0_30: col('g.aging_0_30', 'number'),
  aging31_60: col('g.aging_31_60', 'number'),
  aging61_90: col('g.aging_61_90', 'number'),
  agingOver90: col('g.aging_over_90', 'number'),
};

/** Khóa gom: biển số đã trim; phiếu chưa có biển số gom chung vào chuỗi rỗng (lọc trống khớp, không lộ giá trị giả). */
const PLATE = `COALESCE(TRIM(c.bien_so_xe), '')`;

/**
 * Công nợ phải thu khách hàng v2, gom theo biển số xe. Số dư lấy từ cột đã tính sẵn của vụ việc
 * (như V1; công thức max(0, gốc - đã thu) nằm ở nơi ghi settlement). Điều kiện lọc đặt trên dòng đã gom;
 * khác V1 ở chỗ này: một biển số có nhiều khách thì lọc theo khách vẫn thấy tổng cả biển số.
 */
@Injectable()
export class CustomerDebtQueryService extends AbstractDebtQueryService<
  CustomerDebtRow,
  ObjectLiteral
> {
  protected readonly columns = COLUMNS;
  protected readonly summaryColumns = [
    { key: 'totalAmount', sql: 'g.tong_doanh_thu' },
    { key: 'paidAmount', sql: 'g.da_thanh_toan' },
    { key: 'balanceAmount', sql: 'g.con_phai_thu' },
    { key: 'aging0_30', sql: 'g.aging_0_30' },
    { key: 'aging31_60', sql: 'g.aging_31_60' },
    { key: 'aging61_90', sql: 'g.aging_61_90' },
    { key: 'agingOver90', sql: 'g.aging_over_90' },
  ];
  protected readonly searchColumns = [
    'g.khach_hang_code',
    'g.khach_hang_name',
    'g.bien_so_xe',
  ];
  protected readonly defaultSort = {
    sql: 'g.con_phai_thu',
    direction: 'DESC' as const,
  };
  protected readonly tieBreaker = 'g.bien_so_xe';

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  protected createBaseQuery(
    query: DebtListQuery,
  ): SelectQueryBuilder<ObjectLiteral> {
    const { branchId, from, to, scope } = query as CustomerDebtListQuery;
    const effectiveFrom =
      from && from > GARAGE_DEBT_BASELINE_DATE
        ? from
        : GARAGE_DEBT_BASELINE_DATE;

    if (isLedgerReadEnabled()) {
      const ledger = buildCustomerLedgerQuery(this.dataSource, {
        branchId,
        from: effectiveFrom,
        to,
      });
      if (scope === 'outstanding') ledger.where('g.con_phai_thu > 0');
      return ledger;
    }

    const outer = this.dataSource.createQueryBuilder().from((sub) => {
      sub
        .select(PLATE, 'bien_so_xe')
        .addSelect(`MAX(COALESCE(c.khach_hang_code, ''))`, 'khach_hang_code')
        .addSelect(
          `MAX(COALESCE(c.khach_hang_name, 'Chưa xác định'))`,
          'khach_hang_name',
        )
        .addSelect('MAX(c.branch_external_id)', 'branch_external_id')
        .addSelect('COUNT(c.id)::int', 'so_phieu')
        .addSelect(
          'COALESCE(SUM(c.tien_co_thue), 0)::numeric',
          'tong_doanh_thu',
        )
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
        .andWhere('c.ngay_hoan_thanh_cong_viec >= :debtFrom', {
          debtFrom: effectiveFrom,
        })
        .groupBy(PLATE);
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

    if (scope === 'outstanding') outer.where('g.con_phai_thu > 0');
    return outer;
  }

  protected fetchPage(
    qb: SelectQueryBuilder<ObjectLiteral>,
    offset: number,
    limit: number,
  ): Promise<{ rows: CustomerDebtRow[]; total: number }> {
    return this.fetchRawPage(qb, offset, limit, toCustomerDebtRow);
  }
}
