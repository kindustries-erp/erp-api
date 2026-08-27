import { Injectable, Logger } from '@nestjs/common';
import { SyncCaseService } from './services/sync-case.service';
import { SyncGrossProfitService } from './services/sync-gross-profit.service';
import { SyncDebtService } from './services/sync-debt.service';
import { SyncDeletionService } from './services/sync-deletion.service';
import { SyncRunLoggerService } from './services/sync-run-logger.service';

// Re-export utility functions for full backward compatibility
export {
  parseSafeDate,
  extractNetPayableAmount,
} from './utils/kgara-parser.util';

@Injectable()
export class KgaraSyncService {
  private readonly logger = new Logger(KgaraSyncService.name);

  constructor(
    private readonly syncCaseService: SyncCaseService,
    private readonly syncGrossProfitService: SyncGrossProfitService,
    private readonly syncDebtService: SyncDebtService,
    private readonly syncDeletionService: SyncDeletionService,
    private readonly syncRunLogger: SyncRunLoggerService,
  ) {}

  async syncBranches(): Promise<void> {
    return this.syncCaseService.syncBranches();
  }

  async syncCasesForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    return this.syncCaseService.syncCasesForBranch(
      branchExternalId,
      from,
      to,
      updatedSince,
    );
  }

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
  ): Promise<void> {
    return this.syncGrossProfitService.syncGrossProfitForBranch(
      branchExternalId,
      from,
      to,
    );
  }

  async syncReceivables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    return this.syncDebtService.syncReceivables(
      branchExternalId,
      from,
      to,
      updatedSince,
    );
  }

  async syncPayables(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
  ): Promise<void> {
    return this.syncDebtService.syncPayables(
      branchExternalId,
      from,
      to,
      updatedSince,
    );
  }

  async syncCaseDetail(branchExternalId: string, caseId: string): Promise<any> {
    return this.syncCaseService.syncCaseDetail(branchExternalId, caseId);
  }

  async getIncrementalWatermark(
    branchExternalId: string,
    endpoint: string,
  ): Promise<string | undefined> {
    return this.syncRunLogger.getIncrementalWatermark(
      branchExternalId,
      endpoint,
    );
  }

  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    return this.syncDeletionService.detectAndMarkDeletedCases(
      branchExternalId,
      from,
      to,
      syncedIds,
    );
  }
}
