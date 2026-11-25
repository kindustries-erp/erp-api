import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { findSyncableBranches } from './helpers/syncable-branches.helper';
import { KgaraSyncService } from './kgara-sync.service';
import { KgaraAuthService } from './kgara-auth.service';
import { KgaraBulkSyncService } from './services/kgara-bulk-sync.service';
import { KgaraAccountKey } from './enums/kgara-account.enum';
import { NotificationsPublisherService } from '@/v2/modules/notifications-inbox';
import { RbacPermission } from '@/v2/modules/rbac-roles/entities/rbac-permission.entity';
import { RbacUserRole } from '@/v2/modules/rbac-roles/entities/rbac-user-role.entity';
import {
  isCronEnabled,
  isWithinSyncWindow,
  getNextSyncSlot,
  getSyncSlotKey,
  getVnDateTimeParts,
  runSafeCronJob,
  SYNC_HOURS,
} from '../common/utils/cron.util';
import {
  KGARA_RECENT_SYNC_MONTHS,
  recentMonthsRange,
  splitMonthlyRanges,
  type SyncDateRange,
} from './helpers/sync-range-chunks.helper';

interface BranchSyncStats {
  deleted: number;
  withInvoices: number;
  detailsSynced: number;
}

@Injectable()
export class KgaraSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KgaraSyncScheduler.name);
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private lastExecutedSlotKey: string | null = null;
  private lastBranchSyncAlertKey: string | null = null;

  constructor(
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    @InjectRepository(RbacPermission)
    private readonly permissionRepo: Repository<RbacPermission>,
    @InjectRepository(RbacUserRole)
    private readonly userRoleRepo: Repository<RbacUserRole>,
    private readonly syncService: KgaraSyncService,
    private readonly authService: KgaraAuthService,
    private readonly bulkSyncService: KgaraBulkSyncService,
    private readonly notificationsService: NotificationsPublisherService,
  ) {}

  onModuleInit() {
    if (!isCronEnabled()) {
      this.logger.log(
        'Kgara auto-sync scheduler is disabled in this environment (ENABLE_CRON is not true).',
      );
      return;
    }

    const { nextSlotDate, slotLabel } = getNextSyncSlot();
    this.logger.log(
      `Kgara auto-sync scheduler activated. Next sync slot scheduled at ${slotLabel} (${nextSlotDate.toISOString()}).`,
    );

    // Heartbeat check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkAndTriggerScheduledSync();
    }, 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async checkAndTriggerScheduledSync() {
    if (this.isRunning || !isCronEnabled()) {
      return;
    }

    const now = new Date();
    if (!isWithinSyncWindow(now)) {
      return;
    }

    const { key, label } = getSyncSlotKey(now);
    if (this.lastExecutedSlotKey === key) {
      return; // Slot này đã được thực thi
    }

    this.lastExecutedSlotKey = key;
    this.logger.log(
      `Triggering scheduled Kgara sync for slot ${label} (${key})...`,
    );

    await this.runScheduledSyncCheck();
  }

  /**
   * Đồng bộ vụ việc dịch vụ KGara mỗi giờ vào phút :15 từ 09:15 đến 21:15 (Asia/Ho_Chi_Minh)
   * Decorator @Cron đóng vai trò lớp dự phòng song song.
   */
  @Cron('0 15 9,15,16,17,21 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runScheduledSyncCheck() {
    if (this.isRunning) return;
    // Không chạy chồng lên job đồng bộ thủ công (drawer) đang chạy
    if (!this.bulkSyncService.tryLock()) {
      this.logger.warn(
        'Bỏ qua lượt đồng bộ tự động: đang có lượt đồng bộ khác chạy.',
      );
      return;
    }
    this.isRunning = true;

    // Đánh dấu slot nếu chạy qua Cron trigger
    const now = new Date();
    const { key } = getSyncSlotKey(now);
    this.lastExecutedSlotKey = key;

    try {
      return await runSafeCronJob({
        jobName: 'KgaraCaseSync',
        logger: this.logger,
        checkEnabled: () => isCronEnabled(),
        onError: async (error) => {
          await this.notifyAdminsOnError(error?.message);
        },
        execute: async () => {
          this.logger.log('Starting scheduled Kgara sync check...');
          let totalDeleted = 0;
          let totalWithInvoices = 0;
          let totalDetailsSynced = 0;

          const firstDayTwoMonthsAgo = new Date(
            now.getFullYear(),
            now.getMonth() - 2,
            1,
          );

          const from = firstDayTwoMonthsAgo.toLocaleDateString('en-CA');
          const to = now.toLocaleDateString('en-CA');

          // Lượt cuối ngày: quét sâu 6 tháng gần nhất, tách theo tháng, mỗi tháng đúng khoảng.
          const deepRanges = this.isLastSlotOfDay(now)
            ? this.recentMonthlyRanges(now)
            : null;
          if (deepRanges) {
            this.logger.log(
              `Last slot of the day: deep sync ${deepRanges.length} monthly ranges (${deepRanges.at(-1)?.from} → ${deepRanges[0]?.to}).`,
            );
          }

          // Chỉ xử lý các tài khoản có credentials trong env (MAIN, OJ nếu có *_2)
          const configuredAccounts = this.authService.getConfiguredAccounts();

          // Sync branches for all configured accounts before scanning
          const branchSync =
            await this.syncService.syncBranchesForAccounts(configuredAccounts);
          const failedBranchSync = branchSync.accounts.filter((a) => !a.ok);
          if (failedBranchSync.length > 0) {
            const alertDetail = failedBranchSync
              .map((a) => `${a.accountKey}: ${a.error}`)
              .join('; ');
            // Cùng một lỗi trong cùng một ngày chỉ báo admin một lần
            const alertKey = `${to}|${alertDetail}`;
            if (alertKey !== this.lastBranchSyncAlertKey) {
              this.lastBranchSyncAlertKey = alertKey;
              await this.notifyAdminsOnError(alertDetail);
            }
          } else {
            this.lastBranchSyncAlertKey = null;
          }

          const { branches, linked } = await findSyncableBranches(
            this.branchRepo,
          );
          if (!linked) {
            this.logger.warn(
              'Chưa có chi nhánh KGara nào liên kết chi nhánh ERP: quét tất cả chi nhánh KGara.',
            );
          }

          for (const branch of branches) {
            if (!branch.externalId) continue;
            const accountKey =
              (branch.accountKey as KgaraAccountKey) || KgaraAccountKey.MAIN;
            if (!configuredAccounts.includes(accountKey)) continue;
            this.logger.log(
              `Syncing cases and deletion check for branch ${branch.externalId} (account: ${accountKey}, ${from} to ${to})`,
            );

            const stats = deepRanges
              ? await this.syncBranchDeep(
                  branch.externalId,
                  accountKey,
                  deepRanges,
                )
              : await this.syncBranchWindow(
                  branch.externalId,
                  accountKey,
                  from,
                  to,
                );
            totalDeleted += stats.deleted;
            totalWithInvoices += stats.withInvoices;
            totalDetailsSynced += stats.detailsSynced;
          }

          this.logger.log(
            `Scheduled Kgara sync check completed. Deleted: ${totalDeleted}, With Invoices: ${totalWithInvoices}, Details Synced: ${totalDetailsSynced}`,
          );

          // 3. Gửi thông báo kết quả cho quản trị viên (Zero-crash isolated)
          await this.notifyAdminsOnSuccess(totalDeleted, totalWithInvoices);

          return { totalDeleted, totalWithInvoices, totalDetailsSynced };
        },
      });
    } finally {
      this.isRunning = false;
      this.bulkSyncService.unlock();
    }
  }

  /** Alias tương thích ngược cho các spec test hoặc lời gọi cũ */
  async runHourlySyncCheck() {
    return this.runScheduledSyncCheck();
  }

  /**
   * Tra cứu danh sách User ID nhận thông báo theo chuẩn RBAC ('garage' hoặc '*')
   * Bọc try/catch riêng biệt đảm bảo không bao giờ ném lỗi ra ngoài luồng chính.
   */
  private async getRecipientUserIds(): Promise<string[]> {
    try {
      const perms = await this.permissionRepo.find({
        where: [{ resource: 'garage' }, { resource: '*' }],
      });
      const roleIds = [...new Set(perms.map((p) => p.roleId))].filter(Boolean);
      if (roleIds.length === 0) return [];

      const userRoles = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });
      return [...new Set(userRoles.map((ur) => ur.userId))].filter(Boolean);
    } catch (err: any) {
      this.logger.warn(
        `Không thể phân giải danh sách User nhận thông báo KGara: ${err?.message}`,
      );
      return [];
    }
  }

  /** Lượt cuối ngày theo giờ VN (giờ lớn nhất trong `SYNC_HOURS`). */
  protected isLastSlotOfDay(now: Date): boolean {
    return getVnDateTimeParts(now).hour === Math.max(...SYNC_HOURS);
  }

  /** 6 tháng gần nhất tính từ hôm nay (giờ VN), tách theo tháng, tháng mới trước. */
  private recentMonthlyRanges(now: Date): SyncDateRange[] {
    const { year, month, day } = getVnDateTimeParts(now);
    const range = recentMonthsRange(
      `${year}-${month}-${day}`,
      KGARA_RECENT_SYNC_MONTHS,
    );
    return range ? splitMonthlyRanges(range.from, range.to) : [];
  }

  /** Lượt thường: cửa sổ ngắn + watermark gia tăng, như trước. */
  private async syncBranchWindow(
    branchExternalId: string,
    accountKey: KgaraAccountKey,
    from: string,
    to: string,
  ): Promise<BranchSyncStats> {
    const watermark = await this.syncService.getIncrementalWatermark(
      branchExternalId,
      '/api/v1/gr/cases/list',
      accountKey,
    );
    const result = await this.syncService.syncCasesForBranch(
      branchExternalId,
      from,
      to,
      watermark,
      accountKey,
    );
    const stats: BranchSyncStats = {
      deleted: result?.deletedCount ?? 0,
      withInvoices: result?.withLinkedInvoices.length ?? 0,
      detailsSynced: 0,
    };
    stats.detailsSynced = await this.syncGpAndDetails(
      branchExternalId,
      accountKey,
      { from, to },
    );
    return stats;
  }

  /**
   * Lượt cuối ngày: từng tháng quét đúng khoảng (`exactRange`), kèm lợi nhuận gộp và chi tiết.
   * Tháng lỗi chỉ ghi log rồi chạy tiếp tháng sau.
   */
  private async syncBranchDeep(
    branchExternalId: string,
    accountKey: KgaraAccountKey,
    ranges: SyncDateRange[],
  ): Promise<BranchSyncStats> {
    const stats: BranchSyncStats = {
      deleted: 0,
      withInvoices: 0,
      detailsSynced: 0,
    };
    for (const range of ranges) {
      try {
        const result = await this.syncService.syncCasesForBranch(
          branchExternalId,
          range.from,
          range.to,
          undefined,
          accountKey,
          { exactRange: true },
        );
        stats.deleted += result?.deletedCount ?? 0;
        stats.withInvoices += result?.withLinkedInvoices.length ?? 0;
      } catch (err: any) {
        this.logger.warn(
          `Deep sync ${range.from}..${range.to} for branch ${branchExternalId} (account: ${accountKey}) failed: ${err?.message}`,
        );
        continue;
      }
      stats.detailsSynced += await this.syncGpAndDetails(
        branchExternalId,
        accountKey,
        range,
      );
    }
    return stats;
  }

  /** Lợi nhuận gộp và chi tiết vật tư cho một khoảng; lỗi chỉ ghi log. Trả số dòng chi tiết đã sync. */
  private async syncGpAndDetails(
    branchExternalId: string,
    accountKey: KgaraAccountKey,
    { from, to }: SyncDateRange,
  ): Promise<number> {
    try {
      await this.syncService.syncGrossProfitForBranch(
        branchExternalId,
        from,
        to,
        accountKey,
      );
    } catch (gpErr: any) {
      this.logger.warn(
        `Gross profit sync for branch ${branchExternalId} (account: ${accountKey}) skipped: ${gpErr?.message}`,
      );
    }
    try {
      const detailsRes = await this.syncService.syncCaseDetailsBatch(
        branchExternalId,
        { from, to, force: false, accountKey },
      );
      return detailsRes?.totalLinesSynced ?? 0;
    } catch (detailErr: any) {
      this.logger.warn(
        `Batch case details sync for branch ${branchExternalId} (account: ${accountKey}) skipped: ${detailErr?.message}`,
      );
      return 0;
    }
  }

  private async notifyAdminsOnSuccess(
    totalDeleted: number,
    totalWithInvoices: number,
  ) {
    if (totalDeleted <= 0) return;

    try {
      const userIds = await this.getRecipientUserIds();
      for (const userId of userIds) {
        if (totalWithInvoices > 0) {
          await this.notificationsService.createForUser(userId, {
            title: 'Kgara Sync Alert',
            message: `Phát hiện ${totalDeleted} phiếu bị xóa trên Kgara. Trong đó có ${totalWithInvoices} phiếu đang có chứng từ liên kết cần xử lý.`,
            type: 'WARNING',
          });
        } else {
          await this.notificationsService.createForUser(userId, {
            title: 'Kgara Sync Info',
            message: `Phát hiện ${totalDeleted} phiếu bị xóa trên Kgara. Không có chứng từ liên kết bị ảnh hưởng.`,
            type: 'INFO',
          });
        }
      }
    } catch (notifyErr: any) {
      this.logger.warn(
        `Không thể gửi thông báo KGara Sync tới quản trị viên: ${notifyErr?.message}`,
      );
    }
  }

  private async notifyAdminsOnError(errorMessage?: string) {
    try {
      const userIds = await this.getRecipientUserIds();
      for (const userId of userIds) {
        await this.notificationsService.createForUser(userId, {
          title: 'Kgara Sync Error',
          message: `Lỗi khi chạy đồng bộ tự động Kgara: ${errorMessage || 'Lỗi không xác định'}`,
          type: 'ERROR',
        });
      }
    } catch (notifyErr: any) {
      this.logger.error(
        `Không thể gửi thông báo lỗi KGara tới Admin: ${notifyErr?.message}`,
      );
    }
  }
}
