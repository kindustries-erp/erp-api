import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { TableColumnMap } from '@/common/utils/table-query';
import {
  AbstractDebtQueryService,
  type DebtListQuery,
} from '@/v2/core/debts-core';
import type {
  DebtAllocationRow,
  DebtLedgerRow,
} from '../dto/debt-ledger.types';
import { DebtAllocationGarage } from '../entities/debt-allocation-garage.entity';
import { DebtGarage } from '../entities/debt-garage.entity';
import {
  toDebtAllocationRow,
  toDebtLedgerRow,
} from '../helpers/debt-ledger-row.mapper';

export interface DebtLedgerListQuery extends DebtListQuery {
  branchId: string;
  direction?: string;
  partyType?: string;
  status?: string;
  caseId?: string;
}

const LEDGER_STATUSES = ['OPEN', 'SETTLED', 'VOID'];

const col = (sql: string, type: 'text' | 'number' | 'date') => ({ sql, type });

/** Cột lọc/sắp xếp của sổ nợ (bí danh `d`). SQL cố định, không lấy từ input. */
const COLUMNS: TableColumnMap = {
  direction: col('d.direction', 'text'),
  partyType: col('d.party_type', 'text'),
  partyCode: col('d.party_code', 'text'),
  partyName: col('d.party_name', 'text'),
  licensePlate: col('d.license_plate', 'text'),
  status: col('d.status', 'text'),
  origin: col('d.origin', 'text'),
  originalAmount: col('d.original_amount', 'number'),
  settledAmount: col('d.settled_amount', 'number'),
  balanceAmount: col('d.balance_amount', 'number'),
  dueBaseDate: col('d.due_base_date', 'date'),
};

/** Đọc sổ nợ garage (`debts_garage`) và phân bổ của từng khoản nợ. Mọi truy vấn cách ly theo chi nhánh. */
@Injectable()
export class DebtLedgerQueryService extends AbstractDebtQueryService<
  DebtLedgerRow,
  DebtGarage
> {
  protected readonly columns = COLUMNS;
  protected readonly summaryColumns = [
    { key: 'originalAmount', sql: 'd.original_amount' },
    { key: 'settledAmount', sql: 'd.settled_amount' },
    { key: 'balanceAmount', sql: 'd.balance_amount' },
  ];
  protected readonly searchColumns = [
    'd.party_code',
    'd.party_name',
    'd.license_plate',
  ];
  protected readonly defaultSort = {
    sql: 'd.balance_amount',
    direction: 'DESC' as const,
  };
  protected readonly tieBreaker = 'd.id';

  constructor(
    @InjectRepository(DebtGarage)
    private readonly debts: Repository<DebtGarage>,
    @InjectRepository(DebtAllocationGarage)
    private readonly allocations: Repository<DebtAllocationGarage>,
  ) {
    super();
  }

  protected createBaseQuery(
    query: DebtListQuery,
  ): SelectQueryBuilder<DebtGarage> {
    const q = query as DebtLedgerListQuery;
    const qb = this.debts
      .createQueryBuilder('d')
      .where('d.is_deleted = false')
      .andWhere('d.branch_external_id = :ledgerBranch', {
        ledgerBranch: q.branchId,
      });
    if (q.direction)
      qb.andWhere('d.direction = :ledgerDir', { ledgerDir: q.direction });
    if (q.partyType)
      qb.andWhere('d.party_type = :ledgerParty', { ledgerParty: q.partyType });
    if (q.status && LEDGER_STATUSES.includes(q.status))
      qb.andWhere('d.status = :ledgerStatus', { ledgerStatus: q.status });
    if (q.caseId)
      qb.andWhere('d.case_id = :ledgerCase', { ledgerCase: q.caseId });
    return qb;
  }

  protected async fetchPage(
    qb: SelectQueryBuilder<DebtGarage>,
    offset: number,
    limit: number,
  ): Promise<{ rows: DebtLedgerRow[]; total: number }> {
    const [rows, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { rows: rows.map(toDebtLedgerRow), total };
  }

  /** Phân bổ của một khoản nợ; khoản nợ khác chi nhánh coi như không tồn tại. */
  async findAllocations(
    branchId: string,
    debtId: string,
  ): Promise<DebtAllocationRow[]> {
    const debt = await this.debts.findOne({
      where: { id: debtId, branchExternalId: branchId, isDeleted: false },
    });
    if (!debt) throw new NotFoundException('Không có khoản nợ');
    const rows = await this.allocations.find({
      where: { debtId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map(toDebtAllocationRow);
  }
}
