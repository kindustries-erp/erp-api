import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';

import { applyBranchScope, branchWhere } from '@/v2/core/branches-core';
import { applyGarageOverdueFilter } from '@/kgara-api-core/helpers/garage-cashflow-overdue.helper';
import type { TableColumnMap } from '@/common/utils/table-query';
import {
  AbstractCashflowVoucherQueryService,
  type CashflowVoucherListQuery,
} from '@/v2/core/cashflow-vouchers-core';
import type { CashflowVoucherGarageRow } from '../dto/cashflow-voucher-garage.types';
import { GARAGE_VOUCHER_STATUSES } from '../dto/create-cashflow-voucher-garage.dto';
import { CashflowVoucherGarage } from '../entities/cashflow-voucher-garage.entity';
import { toCashflowVoucherRow } from '../helpers/cashflow-voucher-garage.mapper';

export interface CashflowVoucherGarageListQuery extends CashflowVoucherListQuery {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  voucherType?: string;
  status?: string;
  caseId?: string;
  overdueBucket?: string;
  date_from?: string;
  date_to?: string;
}

const col = (sql: string, type: 'text' | 'number' | 'date') => ({ sql, type });

/** Cột lọc/sắp xếp (bí danh `v`). SQL cố định, không lấy từ input. */
const COLUMNS: TableColumnMap = {
  voucherCode: col('v.voucher_code', 'text'),
  voucherType: col('v.voucher_type', 'text'),
  status: col('v.status', 'text'),
  transDate: col('v.trans_date', 'date'),
  amount: col('v.amount', 'number'),
  licensePlate: col('v.license_plate', 'text'),
  paymentMethod: col('v.payment_method', 'text'),
  partnerName: col('v.partner_name', 'text'),
  payerType: col('v.payer_type', 'text'),
  source: col('v.source', 'text'),
  createdBy: col('v.created_by', 'text'),
};

/** Đọc phiếu thu chi garage v2. Mọi truy vấn cách ly theo chi nhánh; phiếu khác chi nhánh coi như không tồn tại. */
@Injectable()
export class CashflowVoucherGarageQueryService extends AbstractCashflowVoucherQueryService<
  CashflowVoucherGarageRow,
  CashflowVoucherGarage
> {
  protected readonly columns = COLUMNS;
  protected readonly summaryColumns = [{ key: 'amount', sql: 'v.amount' }];
  protected readonly searchColumns = [
    'v.voucher_code',
    'v.license_plate',
    'v.partner_name',
    'v.payment_content',
  ];
  protected readonly defaultSort = {
    sql: 'v.trans_date',
    direction: 'DESC' as const,
  };
  protected readonly tieBreaker = 'v.id';

  constructor(
    @InjectRepository(CashflowVoucherGarage)
    private readonly vouchers: Repository<CashflowVoucherGarage>,
  ) {
    super();
  }

  protected createBaseQuery(
    query: CashflowVoucherListQuery,
  ): SelectQueryBuilder<CashflowVoucherGarage> {
    const q = query as CashflowVoucherGarageListQuery;
    const qb = this.vouchers
      .createQueryBuilder('v')
      .where('v.is_deleted = false');
    applyBranchScope(qb, 'v', q.branchId, 'cfBranch');
    if (q.voucherType)
      qb.andWhere('v.voucher_type = :cfType', { cfType: q.voucherType });
    if (
      q.status &&
      (GARAGE_VOUCHER_STATUSES as readonly string[]).includes(q.status)
    ) {
      qb.andWhere('v.status = :cfStatus', { cfStatus: q.status });
    }
    if (q.caseId) qb.andWhere('v.case_id = :cfCase', { cfCase: q.caseId });
    if (q.date_from)
      qb.andWhere('v.trans_date >= :cfFrom', { cfFrom: q.date_from });
    if (q.date_to) qb.andWhere('v.trans_date <= :cfTo', { cfTo: q.date_to });
    if (q.overdueBucket) {
      applyGarageOverdueFilter(qb, [q.overdueBucket], {
        alias: 'v',
        statusColumn: 'status',
      });
    }
    return qb;
  }

  protected toRow(entity: CashflowVoucherGarage): CashflowVoucherGarageRow {
    return toCashflowVoucherRow(entity);
  }

  async findOne(
    branchId: string | undefined,
    id: string,
  ): Promise<CashflowVoucherGarageRow> {
    const row = await this.vouchers.findOne({
      where: { id, ...branchWhere(branchId), isDeleted: false },
    });
    if (!row) throw new NotFoundException('Không có phiếu thu chi');
    return toCashflowVoucherRow(row);
  }
}
