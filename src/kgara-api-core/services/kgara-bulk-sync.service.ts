import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { KgaraBranch } from '../entities/kgara_branch.entity';
import { KgaraSyncService } from '../kgara-sync.service';
import { KgaraAuthService } from '../kgara-auth.service';
import { KgaraAccountKey } from '../enums/kgara-account.enum';

export type KgaraBulkSyncScope =
  | 'all'
  | 'cases'
  | 'gross-profit'
  | 'case-details';

export interface KgaraBulkSyncOptions {
  scope: KgaraBulkSyncScope;
  from?: string;
  to?: string;
  includeDetails?: boolean;
  forceDetails?: boolean;
}

export interface KgaraBulkSyncBranchResult {
  branchExternalId: string;
  accountKey: string;
  ok: boolean;
  error?: string;
}

export interface KgaraBulkSyncState {
  status: 'idle' | 'running' | 'completed' | 'failed';
  scope: KgaraBulkSyncScope | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalBranches: number;
  completedBranches: number;
  currentBranch: { branchExternalId: string; accountKey: string } | null;
  accounts: { accountKey: KgaraAccountKey; ok: boolean; error?: string }[];
  results: KgaraBulkSyncBranchResult[];
  message: string | null;
}

const idleState = (): KgaraBulkSyncState => ({
  status: 'idle',
  scope: null,
  startedAt: null,
  finishedAt: null,
  totalBranches: 0,
  completedBranches: 0,
  currentBranch: null,
  accounts: [],
  results: [],
  message: null,
});

/**
 * Đồng bộ mọi chi nhánh của các tài khoản đã cấu hình, chạy nền.
 * Trạng thái và khóa nằm trong bộ nhớ (một instance), cùng khóa dùng với cron.
 */
@Injectable()
export class KgaraBulkSyncService {
  private readonly logger = new Logger(KgaraBulkSyncService.name);
  private locked = false;
  private state: KgaraBulkSyncState = idleState();

  constructor(
    private readonly syncService: KgaraSyncService,
    private readonly authService: KgaraAuthService,
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
  ) {}

  /** Giành khóa chạy đồng bộ; trả false nếu đang có lượt khác (thủ công hoặc cron). */
  tryLock(): boolean {
    if (this.locked) return false;
    this.locked = true;
    return true;
  }

  unlock(): void {
    this.locked = false;
  }

  getStatus(): KgaraBulkSyncState {
    return {
      ...this.state,
      accounts: [...this.state.accounts],
      results: [...this.state.results],
    };
  }

  /** Khởi động job nền và trả trạng thái ngay; ném 409 nếu đang có lượt chạy. */
  start(options: KgaraBulkSyncOptions): KgaraBulkSyncState {
    if (!this.tryLock()) {
      throw new ConflictException(
        'Đồng bộ đang chạy (thủ công hoặc tự động), vui lòng đợi lượt hiện tại kết thúc.',
      );
    }

    this.state = {
      ...idleState(),
      status: 'running',
      scope: options.scope,
      startedAt: new Date().toISOString(),
    };

    this.runJob(options).catch((error: any) => {
      this.logger.error(`Bulk sync job crashed: ${error?.message}`);
    });

    return this.getStatus();
  }

  private async runJob(options: KgaraBulkSyncOptions): Promise<void> {
    try {
      const accountKeys = this.authService.getConfiguredAccounts();

      // Làm mới danh sách chi nhánh trước để chi nhánh mới (ví dụ OJ) xuất hiện trong lượt này
      const branchSync =
        await this.syncService.syncBranchesForAccounts(accountKeys);
      this.state.accounts = branchSync.accounts.map(
        ({ accountKey, ok, error }) => ({
          accountKey,
          ok,
          error,
        }),
      );

      const branches = await this.branchRepo.find({
        where: { accountKey: In(accountKeys) },
        order: { name: 'ASC' },
      });
      this.state.totalBranches = branches.length;

      for (const branch of branches) {
        const accountKey = branch.accountKey as KgaraAccountKey;
        this.state.currentBranch = {
          branchExternalId: branch.externalId,
          accountKey,
        };
        try {
          await this.syncBranch(branch.externalId, accountKey, options);
          this.state.results.push({
            branchExternalId: branch.externalId,
            accountKey,
            ok: true,
          });
        } catch (error: any) {
          this.logger.warn(
            `Bulk sync failed for branch ${branch.externalId} (account: ${accountKey}): ${error?.message}`,
          );
          this.state.results.push({
            branchExternalId: branch.externalId,
            accountKey,
            ok: false,
            error: error?.message || 'Unknown error',
          });
        }
        this.state.completedBranches++;
      }

      this.state.status = 'completed';
      this.state.message = this.state.results.some((r) => !r.ok)
        ? 'Hoàn tất có chi nhánh lỗi, xem chi tiết từng chi nhánh.'
        : 'Hoàn tất đồng bộ tất cả chi nhánh.';
    } catch (error: any) {
      this.state.status = 'failed';
      this.state.message = error?.message || 'Unknown error';
    } finally {
      this.state.currentBranch = null;
      this.state.finishedAt = new Date().toISOString();
      this.unlock();
    }
  }

  private async syncBranch(
    branchExternalId: string,
    accountKey: KgaraAccountKey,
    options: KgaraBulkSyncOptions,
  ): Promise<void> {
    const { from, to, includeDetails, forceDetails } = options;

    switch (options.scope) {
      case 'cases':
        await this.syncService.syncCasesForBranch(
          branchExternalId,
          from,
          to,
          undefined,
          accountKey,
        );
        return;
      case 'gross-profit':
        await this.syncService.syncGrossProfitForBranch(
          branchExternalId,
          from,
          to,
          accountKey,
        );
        return;
      case 'case-details':
        await this.syncService.syncCaseDetailsBatch(branchExternalId, {
          from,
          to,
          force: forceDetails,
          accountKey,
        });
        return;
      case 'all':
        await this.syncService.syncAllInOne(branchExternalId, {
          from,
          to,
          includeDetails,
          forceDetails,
          accountKey,
          skipBranchSync: true,
        });
        return;
    }
  }
}
