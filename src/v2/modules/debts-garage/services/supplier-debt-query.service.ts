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
import { GARAGE_DEBT_BASELINE_DATE } from '../helpers/garage-debt-sql.helper';
import { buildSupplierLedgerQuery } from '../helpers/ledger-read.helper';

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

/**
 * Công nợ phải trả v2, gom theo biển số xe, đọc từ sổ nợ `debts_garage` (dòng PAYABLE, chỉ vụ chi phí > 0).
 * Chi phí / đã trả / còn lại khớp công thức V1 (`kgara_*` + lãi gộp + PAYMENT), đối soát `MISMATCH 0`.
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

    // Luôn đọc sổ nợ `debts_garage` (bỏ cờ DEBTS_GARAGE_LEDGER_READ 2026-11-28). Nhánh tính từ `kgara_*`
    // cũ: `buildLegacySupplierDebtQuery` (helpers/legacy-kgara-debt-read.helper.ts), cùng tham số.
    const ledger = buildSupplierLedgerQuery(this.dataSource, {
      branchId,
      from: effectiveFrom,
      to,
    });
    if (scope === 'outstanding') ledger.where('g.balance_amount > 0');
    return ledger;
  }

  protected fetchPage(
    qb: SelectQueryBuilder<ObjectLiteral>,
    offset: number,
    limit: number,
  ): Promise<{ rows: SupplierDebtRow[]; total: number }> {
    return this.fetchRawPage(qb, offset, limit, toSupplierDebtRow);
  }
}
