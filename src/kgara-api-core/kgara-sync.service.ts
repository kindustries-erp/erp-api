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

  async syncCaseDetailsBatch(
    branchExternalId?: string,
    options?: {
      from?: string;
      to?: string;
      force?: boolean;
      concurrency?: number;
    },
  ): Promise<{
    totalCasesProcessed: number;
    totalLinesSynced: number;
    errorsCount: number;
  }> {
    return this.syncCaseService.syncCaseDetailsBatch(branchExternalId, options);
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

  async syncAllInOne(
    branchExternalId: string,
    options?: {
      from?: string;
      to?: string;
      includeDetails?: boolean;
      forceDetails?: boolean;
    },
  ): Promise<{
    casesResult: { deletedCount: number; withLinkedInvoices: string[] };
    grossProfitSuccess: boolean;
    detailsResult?: {
      totalCasesProcessed: number;
      totalLinesSynced: number;
      errorsCount: number;
    };
  }> {
    this.logger.log(
      `Starting All-In-One sync for branch: ${branchExternalId}, from: ${options?.from}, to: ${options?.to}, includeDetails: ${options?.includeDetails}`,
    );

    try {
      await this.syncBranches();
    } catch (e: any) {
      this.logger.warn(`Sync branches warning: ${e?.message}`);
    }

    const casesResult = await this.syncCasesForBranch(
      branchExternalId,
      options?.from,
      options?.to,
    );

    let grossProfitSuccess = false;
    try {
      await this.syncGrossProfitForBranch(
        branchExternalId,
        options?.from,
        options?.to,
      );
      grossProfitSuccess = true;
    } catch (gpErr: any) {
      this.logger.warn(`Sync gross profit warning: ${gpErr?.message}`);
    }

    let detailsResult:
      | {
          totalCasesProcessed: number;
          totalLinesSynced: number;
          errorsCount: number;
        }
      | undefined;

    if (options?.includeDetails) {
      try {
        detailsResult = await this.syncCaseDetailsBatch(branchExternalId, {
          from: options?.from,
          to: options?.to,
          force: options?.forceDetails,
        });
      } catch (detErr: any) {
        this.logger.warn(`Sync case details warning: ${detErr?.message}`);
      }
    }

    return {
      casesResult,
      grossProfitSuccess,
      detailsResult,
    };
  }
}
