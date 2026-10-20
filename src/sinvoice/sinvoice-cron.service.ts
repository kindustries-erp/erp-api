import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SinvoiceService } from './sinvoice.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import {
  isInvoiceCronEnabled,
  isWithinInvoiceSyncWindow,
  getNextInvoiceSyncSlot,
  getSyncSlotKey,
  runSafeCronJob,
} from '../common/utils/cron.util';

@Injectable()
export class SinvoiceCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SinvoiceCronService.name);
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private isPausedDueToAuthError = false;
  private lastExecutedSlotKey: string | null = null;

  constructor(
    private readonly sinvoiceService: SinvoiceService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(CorePermission)
    private readonly permissionRepo: Repository<CorePermission>,
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepo: Repository<CoreUserRole>,
  ) {}

  onModuleInit() {
    if (!isInvoiceCronEnabled()) {
      this.logger.log(
        'Sinvoice draft auto-sync cron is disabled in this environment (ENABLE_INVOICE_CRON is not true).',
      );
      return;
    }

    const { nextSlotDate, slotLabel } = getNextInvoiceSyncSlot();
    this.logger.log(
      `Sinvoice draft auto-sync activated. Next sync slot scheduled at ${slotLabel} (${nextSlotDate.toISOString()}).`,
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

  /**
   * Khôi phục tiến trình tự động đồng bộ khi người dùng cập nhật cấu hình Viettel mới
   */
  public resumeAfterPasswordUpdate() {
    if (this.isPausedDueToAuthError) {
      this.isPausedDueToAuthError = false;
      this.lastExecutedSlotKey = null;
      this.logger.log(
        'Tự động đồng bộ Hóa đơn nháp Viettel đã được mở khóa lại sau khi cập nhật thông tin mới.',
      );
    }
  }

  public isAuthPaused(): boolean {
    return this.isPausedDueToAuthError;
  }

  private async checkAndTriggerScheduledSync() {
    if (this.isRunning) return;

    if (!isInvoiceCronEnabled() || this.isPausedDueToAuthError) {
      return;
    }

    const now = new Date();
    if (!isWithinInvoiceSyncWindow(now)) {
      return;
    }

    const { key, label } = getSyncSlotKey(now);
    if (this.lastExecutedSlotKey === key) {
      return; // Đã chạy xong cho khung giờ này
    }

    this.lastExecutedSlotKey = key;
    this.logger.log(
      `Triggering scheduled Sinvoice draft sync for slot ${label} (${key})...`,
    );

    await this.autoSyncDrafts();
  }

  async autoSyncDrafts() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await runSafeCronJob({
        jobName: 'SinvoiceDraftSync',
        logger: this.logger,
        checkEnabled: () => isInvoiceCronEnabled(),
        isPaused: () => this.isPausedDueToAuthError,
        onAuthError: async (err) => {
          this.isPausedDueToAuthError = true;
          await this.notifyPasswordError(err?.message);
        },
        onError: async (err) => {
          this.logger.error('Error during Sinvoice draft auto-sync', err);
        },
        execute: async () => {
          const res = await this.sinvoiceService.syncDraftsFromViettel();
          if (res && res.changed && (res.added > 0 || res.removed > 0)) {
            await this.notifySyncSuccess(res.synced, res.added, res.removed);
          }
        },
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async notifyPasswordError(details?: string) {
    try {
      const perms = await this.permissionRepo.find({
        where: [{ resource: 'invoices' }, { resource: '*' }],
      });
      const roleIds = [...new Set(perms.map((p) => p.roleId))];
      if (roleIds.length === 0) return;

      const userRoles = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });
      const userIds = [...new Set(userRoles.map((ur) => ur.userId))];

      for (const userId of userIds) {
        await this.notificationsService.createForUser(userId, {
          type: 'ERROR',
          title: 'Tạm dừng đồng bộ Hóa đơn nháp Viettel (Sai mật khẩu)',
          message: `Hệ thống phát hiện thông tin đăng nhập Viettel S-Invoice không chính xác (${details || 'Sai mật khẩu/tài khoản'}). Tiến trình tự động đồng bộ đã tạm dừng ngay lập tức để bảo vệ tài khoản. Vui lòng vào Cài đặt để cập nhật lại thông tin.`,
        });
      }
    } catch (e) {
      this.logger.error('Failed to send Viettel auth error notification', e);
    }
  }

  private async notifySyncSuccess(
    syncedCount: number,
    added: number,
    removed: number,
  ) {
    try {
      const perms = await this.permissionRepo.find({
        where: [{ resource: 'invoices' }, { resource: '*' }],
      });
      const roleIds = [...new Set(perms.map((p) => p.roleId))];
      if (roleIds.length === 0) return;

      const userRoles = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });
      const userIds = [...new Set(userRoles.map((ur) => ur.userId))];

      for (const userId of userIds) {
        await this.notificationsService.createForUser(userId, {
          type: 'INFO',
          title: 'Đồng bộ hóa đơn nháp thành công',
          message: `Danh sách hóa đơn nháp Viettel đã cập nhật: +${added} mới, -${removed} đã xoá. Tổng hiện tại: ${syncedCount} nháp.`,
          metadata: {
            i18nTitleKey: 'erpInvoices:sinvoiceDraft.notifyTitle',
            i18nMessageKey: 'erpInvoices:sinvoiceDraft.notifyMessage',
            i18nParams: { added, removed, syncedCount },
          },
        });
      }
    } catch (e) {
      this.logger.error('Failed to send draft sync success notifications', e);
    }
  }
}
