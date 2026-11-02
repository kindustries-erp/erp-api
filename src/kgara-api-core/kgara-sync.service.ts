import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SyncCaseService } from './services/sync-case.service';
import { SyncGrossProfitService } from './services/sync-gross-profit.service';
import { SyncDebtService } from './services/sync-debt.service';
import { SyncDeletionService } from './services/sync-deletion.service';
import { SyncRunLoggerService } from './services/sync-run-logger.service';
import { KgaraAccountKey } from './enums/kgara-account.enum';
import { KgaraBranch } from './entities/kgara_branch.entity';

// Re-export utility functions for full backward compatibility
export {
  parseSafeDate,
  extractNetPayableAmount,
} from './utils/kgara-parser.util';
export { KgaraAccountKey } from './enums/kgara-account.enum';

export interface KgaraAccountBranchSyncResult {
  accountKey: KgaraAccountKey;
  ok: boolean;
  error?: string;
}

export interface KgaraAllBranchesSyncResult {
  success: boolean;
  accounts: KgaraAccountBranchSyncResult[];
  branches: {
    branchExternalId: string;
    accountKey: string;
    ok: boolean;
    error?: string;
    result?: Awaited<ReturnType<KgaraSyncService['syncAllInOne']>>;
  }[];
}

@Injectable()
export class KgaraSyncService {
  private readonly logger = new Logger(KgaraSyncService.name);
  private allBranchesRunning = false;

  constructor(
    private readonly syncCaseService: SyncCaseService,
    private readonly syncGrossProfitService: SyncGrossProfitService,
    private readonly syncDebtService: SyncDebtService,
    private readonly syncDeletionService: SyncDeletionService,
    private readonly syncRunLogger: SyncRunLoggerService,
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
  ) {}

  async syncBranches(
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<void> {
    return this.syncCaseService.syncBranches(accountKey);
  }

  /** Sync chi nhánh từng tài khoản; lỗi của tài khoản này không chặn tài khoản khác. */
  async syncBranchesForAccounts(accountKeys: KgaraAccountKey[]): Promise<{
    success: boolean;
    accounts: KgaraAccountBranchSyncResult[];
  }> {
    const accounts: KgaraAccountBranchSyncResult[] = [];
    for (const accountKey of accountKeys) {
      try {
        await this.syncBranches(accountKey);
        accounts.push({ accountKey, ok: true });
      } catch (error: any) {
        this.logger.warn(
          `Sync branches for account ${accountKey} failed: ${error?.message}`,
        );
        accounts.push({
          accountKey,
          ok: false,
          error: error?.message || 'Unknown error',
        });
      }
    }
    return { success: accounts.every((a) => a.ok), accounts };
  }

  /**
   * Đồng bộ tuần tự mọi chi nhánh của các tài khoản được chỉ định.
   * Lỗi một chi nhánh không dừng các chi nhánh còn lại; chỉ cho một lượt chạy tại một thời điểm.
   */
  async syncAllBranches(
    accountKeys: KgaraAccountKey[],
    options?: {
      from?: string;
      to?: string;
      includeDetails?: boolean;
      forceDetails?: boolean;
    },
  ): Promise<KgaraAllBranchesSyncResult> {
    if (this.allBranchesRunning) {
      throw new ConflictException(
        'Đồng bộ tất cả chi nhánh đang chạy, vui lòng đợi lượt hiện tại kết thúc.',
      );
    }
    this.allBranchesRunning = true;

    try {
      const branchSync = await this.syncBranchesForAccounts(accountKeys);
      const branches = await this.branchRepo.find({
        where: { accountKey: In(accountKeys) },
        order: { name: 'ASC' },
      });

      const results: KgaraAllBranchesSyncResult['branches'] = [];
      for (const branch of branches) {
        const accountKey = branch.accountKey as KgaraAccountKey;
        try {
          const result = await this.syncAllInOne(branch.externalId, {
            ...options,
            accountKey,
            skipBranchSync: true,
          });
          results.push({
            branchExternalId: branch.externalId,
            accountKey,
            ok: true,
            result,
          });
        } catch (error: any) {
          this.logger.warn(
            `All-branches sync failed for branch ${branch.externalId} (account: ${accountKey}): ${error?.message}`,
          );
          results.push({
            branchExternalId: branch.externalId,
            accountKey,
            ok: false,
            error: error?.message || 'Unknown error',
          });
        }
      }

      return {
        success: branchSync.success && results.every((r) => r.ok),
        accounts: branchSync.accounts,
        branches: results,
      };
    } finally {
      this.allBranchesRunning = false;
    }
  }

  async syncCasesForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    updatedSince?: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    return this.syncCaseService.syncCasesForBranch(
      branchExternalId,
      from,
      to,
      updatedSince,
      accountKey,
    );
  }

  async syncGrossProfitForBranch(
    branchExternalId: string,
    from?: string,
    to?: string,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<void> {
    return this.syncGrossProfitService.syncGrossProfitForBranch(
      branchExternalId,
      from,
      to,
      accountKey,
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

  async syncCaseDetail(
    branchExternalId: string,
    caseId: string,
    accountKey?: KgaraAccountKey,
  ): Promise<any> {
    return this.syncCaseService.syncCaseDetail(
      branchExternalId,
      caseId,
      accountKey,
    );
  }

  async syncCaseDetailsBatch(
    branchExternalId?: string,
    options?: {
      from?: string;
      to?: string;
      force?: boolean;
      concurrency?: number;
      accountKey?: KgaraAccountKey;
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
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<string | undefined> {
    return this.syncRunLogger.getIncrementalWatermark(
      branchExternalId,
      endpoint,
      accountKey,
    );
  }

  async detectAndMarkDeletedCases(
    branchExternalId: string,
    from: string,
    to: string,
    syncedIds: Set<string>,
    accountKey: KgaraAccountKey = KgaraAccountKey.MAIN,
  ): Promise<{ deletedCount: number; withLinkedInvoices: string[] }> {
    return this.syncDeletionService.detectAndMarkDeletedCases(
      branchExternalId,
      from,
      to,
      syncedIds,
      accountKey,
    );
  }

  async syncAllInOne(
    branchExternalId: string,
    options?: {
      from?: string;
      to?: string;
      includeDetails?: boolean;
      forceDetails?: boolean;
      accountKey?: KgaraAccountKey;
      skipBranchSync?: boolean;
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
    const accountKey = options?.accountKey || KgaraAccountKey.MAIN;
    this.logger.log(
      `Starting All-In-One sync for branch: ${branchExternalId} (account: ${accountKey}), from: ${options?.from}, to: ${options?.to}, includeDetails: ${options?.includeDetails}`,
    );

    if (!options?.skipBranchSync) {
      try {
        await this.syncBranches(accountKey);
      } catch (e: any) {
        this.logger.warn(`Sync branches warning: ${e?.message}`);
      }
    }

    const casesResult = await this.syncCasesForBranch(
      branchExternalId,
      options?.from,
      options?.to,
      undefined,
      accountKey,
    );

    let grossProfitSuccess = false;
    try {
      await this.syncGrossProfitForBranch(
        branchExternalId,
        options?.from,
        options?.to,
        accountKey,
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
          accountKey,
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
