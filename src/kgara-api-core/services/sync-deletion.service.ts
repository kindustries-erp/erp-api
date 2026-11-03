import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';
import { parseSafeDate } from '../utils/kgara-parser.util';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

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
   * Scoped strictly by branch and accountKey to avoid cross-account deletion.
   */
  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    this.logger.log(
      `Running deletion detection for branch ${branchExternalId} (account: ${accountKey}) from ${from} to ${to}...`,
    );

    const fromDate = parseSafeDate(from);
    const toDate = parseSafeDate(to);

    const qb = this.caseRepo
      .createQueryBuilder('case')
      .leftJoin('erp_module_categories', 'cat', 'cat.id = case.category_id')
      .where('case.branchExternalId = :branchExternalId', { branchExternalId })
      .andWhere('case.kgaraDeletedAt IS NULL');

    if (accountKey === KgaraAccountKey.OJ) {
      // Phạm vi theo account nguồn, không theo nhãn: nhãn OJ có ở cả MAIN và OJ
      qb.andWhere('case.accountKey = :accountKey', { accountKey: 'OJ' });
    } else {
      // Scoped to MAIN cases, excluding OJ cases
      qb.andWhere(
        '(case.accountKey = :accountKey OR case.accountKey IS NULL)',
        { accountKey: 'MAIN' },
      );
      qb.andWhere(
        '(COALESCE(cat.code, case.classification) NOT IN (:...excluded) OR (cat.code IS NULL AND case.classification IS NULL))',
        { excluded: ['OJ', 'OJ_NGOAI'] },
      );
    }

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
        `Case ${c.hdPhieuDichVuId} (account: ${accountKey}) marked as deleted (count: ${c.kgaraDeleteCount}). Has linked invoices: ${hasLinks > 0}`,
      );
    }

    return {
      deletedCount: deletedCases.length,
      withLinkedInvoices: casesWithInvoices,
    };
  }
}
