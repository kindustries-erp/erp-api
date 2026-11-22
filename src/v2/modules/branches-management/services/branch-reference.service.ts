import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BranchReference, BranchReferencePort } from '@/v2/core/branches-core';

/** Bảng đang giữ khóa ngoại/cột `branch_id` trỏ tới `branches_management`. Thêm bảng mới ở đây. */
const REFERENCING_TABLES: ReadonlyArray<{ table: string; live?: string }> = [
  { table: 'erp_bank_accounts' },
  { table: 'erp_bank_transactions' },
  { table: 'erp_cash_books' },
  { table: 'erp_journal_entries' },
  { table: 'erp_operating_expenses' },
  { table: 'employees_management', live: 'is_deleted = false' },
  { table: 'debts_garage', live: 'is_deleted = false' },
  { table: 'debt_allocations_garage' },
  { table: 'cashflow_vouchers_garage', live: 'is_deleted = false' },
];

@Injectable()
export class BranchReferenceService extends BranchReferencePort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async findReferences(branchId: string): Promise<BranchReference[]> {
    const found: BranchReference[] = [];
    for (const { table, live } of REFERENCING_TABLES) {
      // Tên bảng lấy từ danh sách cố định ở trên, id đi qua tham số.
      const rows: Array<{ count: string }> = await this.dataSource.query(
        `SELECT count(*)::text AS count FROM ${table} WHERE branch_id = $1${live ? ` AND ${live}` : ''}`,
        [branchId],
      );
      const count = Number(rows[0]?.count ?? 0);
      if (count > 0) found.push({ table, count });
    }
    return found;
  }
}
