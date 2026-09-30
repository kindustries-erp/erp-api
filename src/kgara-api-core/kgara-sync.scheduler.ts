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
import { KgaraSyncService } from './kgara-sync.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import {
  isCronEnabled,
  isWithinSyncWindow,
  getNextSyncSlot,
  getSyncSlotKey,
  runSafeCronJob,
} from '../common/utils/cron.util';

@Injectable()
export class KgaraSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KgaraSyncScheduler.name);
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private lastExecutedSlotKey: string | null = null;

  constructor(
    @InjectRepository(KgaraBranch)
    private readonly branchRepo: Repository<KgaraBranch>,
    @InjectRepository(CorePermission)
    private readonly permissionRepo: Repository<CorePermission>,
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepo: Repository<CoreUserRole>,
    private readonly syncService: KgaraSyncService,
    private readonly notificationsService: NotificationsService,
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
   * Đồng bộ vụ việc dịch vụ KGara tại 5 mốc cố định: 09:15, 15:15, 16:15, 17:15, 21:15 (Asia/Ho_Chi_Minh)
   * Decorator @Cron đóng vai trò lớp dự phòng song song.
   */
  @Cron('0 15 9,15,16,17,21 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runScheduledSyncCheck() {
    if (this.isRunning) return;
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
          const branches = await this.branchRepo.find();

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

          for (const branch of branches) {
            if (!branch.externalId) continue;
            this.logger.log(
              `Syncing cases and deletion check for branch ${branch.externalId} (${from} to ${to})`,
            );

            // Watermark incremental sync
            const watermark = await this.syncService.getIncrementalWatermark(
              branch.externalId,
              '/api/v1/gr/cases/list',
            );

            // 1. Sync cases, gross profit, and soft deletion
            const result = await this.syncService.syncCasesForBranch(
              branch.externalId,
              from,
              to,
              watermark,
            );

            if (result) {
              totalDeleted += result.deletedCount;
              totalWithInvoices += result.withLinkedInvoices.length;
            }

            // 2. Batch sync parts & labor details for cases that lack details
            try {
              const detailsRes = await this.syncService.syncCaseDetailsBatch(
                branch.externalId,
                { from, to, force: false },
              );
              if (detailsRes) {
                totalDetailsSynced += detailsRes.totalLinesSynced;
              }
            } catch (detailErr: any) {
              this.logger.warn(
                `Batch case details sync for branch ${branch.externalId} skipped: ${detailErr?.message}`,
              );
            }
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
