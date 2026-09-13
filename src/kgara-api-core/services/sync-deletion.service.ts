import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { parseSafeDate } from '../utils/kgara-parser.util';

@Injectable()
export class SyncDeletionService {
  private readonly logger = new Logger(SyncDeletionService.name);

  constructor(
    @InjectRepository(KgaraCase)
    private readonly caseRepo: Repository<KgaraCase>,
    @InjectRepository(KgaraCaseLinkedInvoice)
    private readonly linkedInvoiceRepo: Repository<KgaraCaseLinkedInvoice>,
  ) {}

  /**
   * Helper to detect and mark soft-deleted cases that no longer exist on Kgara.
   */
  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(
      `Running deletion detection for branch ${branchExternalId} from ${from} to ${to}...`,
    );

    const fromDate = parseSafeDate(from);
    const toDate = parseSafeDate(to);

    // Find all cases in ERP for this branch and date range (excluding manual external cases like OJ_NGOAI)
    const qb = this.caseRepo
      .createQueryBuilder('case')
      .where('case.branchExternalId = :branchExternalId', { branchExternalId })
      .andWhere('case.kgaraDeletedAt IS NULL')
      .andWhere(
        '(case.classification != :ojNgoai OR case.classification IS NULL)',
        { ojNgoai: 'OJ_NGOAI' },
      );

    if (fromDate) {
      const fromStr = from.includes('T')
        ? from
        : `${from.split('T')[0]} 00:00:00`;
      qb.andWhere('case.ngayPhatSinh >= :fromStr', { fromStr });
    }
    if (toDate) {
      const toStr = to.includes('T') ? to : `${to.split('T')[0]} 23:59:59.999`;
      qb.andWhere('case.ngayPhatSinh <= :toStr', { toStr });
    }

    const erpCases = await qb.getMany();

    const deletedCases = erpCases.filter(
      (c) => !syncedIds.has(c.hdPhieuDichVuId),
    );

    if (deletedCases.length === 0) {
      return { deletedCount: 0, withLinkedInvoices: [] };
    }

    const casesWithInvoices: string[] = [];

    for (const c of deletedCases) {
      // Check if case has linked invoices
      const hasLinks = await this.linkedInvoiceRepo.count({
        where: { caseDbId: c.id },
      });

      if (hasLinks > 0) {
        casesWithInvoices.push(c.hdPhieuDichVuId);
      }

      c.kgaraDeleteCount += 1;

      // If deleted 2 or more times, mark as definitely deleted
      if (c.kgaraDeleteCount >= 2) {
        c.kgaraDeletedAt = new Date();
      }

      await this.caseRepo.save(c);

      this.logger.warn(
        `Case ${c.hdPhieuDichVuId} marked as deleted (count: ${c.kgaraDeleteCount}). Has linked invoices: ${hasLinks > 0}`,
      );
    }

    return {
      deletedCount: deletedCases.length,
      withLinkedInvoices: casesWithInvoices,
    };
  }
}
