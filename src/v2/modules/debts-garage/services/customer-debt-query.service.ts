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
import { GARAGE_DEBT_BASELINE_DATE } from '../helpers/garage-debt-sql.helper';
import { buildCustomerLedgerQuery } from '../helpers/ledger-read.helper';

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

/**
 * Công nợ phải thu khách hàng v2, gom theo biển số xe, đọc từ sổ nợ `debts_garage` (dòng RECEIVABLE của
 * khách và bảo hiểm). Số dư khớp V1 `kgara_cases.tien_con_phai_thanh_toan` (đối soát `MISMATCH 0`).
 * Điều kiện lọc đặt trên dòng đã gom: một biển số có nhiều khách thì lọc theo khách vẫn thấy tổng cả biển số.
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

    // Luôn đọc sổ nợ `debts_garage` (bỏ cờ DEBTS_GARAGE_LEDGER_READ 2026-11-28). Nhánh tính từ `kgara_*`
    // cũ: `buildLegacyCustomerDebtQuery` (helpers/legacy-kgara-debt-read.helper.ts), cùng tham số.
    const ledger = buildCustomerLedgerQuery(this.dataSource, {
      branchId,
      from: effectiveFrom,
      to,
    });
    if (scope === 'outstanding') ledger.where('g.con_phai_thu > 0');
    return ledger;
  }

  protected fetchPage(
    qb: SelectQueryBuilder<ObjectLiteral>,
    offset: number,
    limit: number,
  ): Promise<{ rows: CustomerDebtRow[]; total: number }> {
    return this.fetchRawPage(qb, offset, limit, toCustomerDebtRow);
  }
}
