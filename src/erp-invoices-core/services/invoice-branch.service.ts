import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { AccountingCoreService } from '../../accounting-core/services/accounting-core.service';
import {
  normalizeBranchColumns,
  readBranchIds,
} from '../../common/utils/branch-ids.util';

export interface AssignBranchOptions {
  /** Chỉ ghi cho hóa đơn chưa có chi nhánh (dùng cho import và đồng bộ cổng thuế). */
  onlyIfUnassigned?: boolean;
}

/**
 * Gán chi nhánh cho hóa đơn. Ghi cả `branch_ids` và `branch_id`, và với hóa đơn đã ghi sổ
 * tái phân bổ bút toán trong cùng transaction: lỗi ở bất kỳ bước nào thì rollback toàn bộ.
 */
@Injectable()
export class InvoiceBranchService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly repo: Repository<ErpInvoice>,
    private readonly accountingCoreService: AccountingCoreService,
    private readonly dataSource: DataSource,
  ) {}

  async assign(
    ids: string[],
    branchIds: string[],
    options: AssignBranchOptions = {},
  ): Promise<{ updated: string[]; skipped: string[] }> {
    if (ids.length === 0) return { updated: [], skipped: [] };
    const target = normalizeBranchColumns({ branchIds });

    return this.dataSource.transaction(async (manager) => {
      await this.assertBranchesActive(manager, target.branchIds);

      const invoices = await manager.find(ErpInvoice, {
        where: { id: In(ids), isDeleted: false },
      });

      const updated: string[] = [];
      const skipped: string[] = [];
      for (const invoice of invoices) {
        const current = readBranchIds(invoice);
        const unchanged = sameIds(current, target.branchIds);
        const blocked = options.onlyIfUnassigned && current.length > 0;
        if (unchanged || blocked) {
          skipped.push(invoice.id);
          continue;
        }

        await manager.update(ErpInvoice, { id: invoice.id }, target);
        if (invoice.postingStatus === 'POSTED') {
          await this.accountingCoreService.reallocateJournalEntriesBySource(
            invoice.id,
            'INVOICE',
            target.branchIds,
            invoice.direction === 'IN' ? 'HĐM' : 'HĐB',
            manager,
          );
        }
        updated.push(invoice.id);
      }
      return { updated, skipped };
    });
  }

  /** Mọi chi nhánh được gán phải còn hoạt động (`erp_branches.is_active`). */
  private async assertBranchesActive(
    manager: EntityManager,
    branchIds: string[],
  ): Promise<void> {
    if (branchIds.length === 0) return;
    const found: { id: string }[] = await manager.query(
      `SELECT id FROM erp_branches WHERE id = ANY($1::uuid[]) AND is_active = true`,
      [branchIds],
    );
    if (found.length !== branchIds.length) {
      throw new BadRequestException('Có chi nhánh không tồn tại.');
    }
  }
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
