import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ErpInvoicesCoreService } from './erp-invoices-core.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import {
  isAuthError,
  isGdtInvoiceCronEnabled,
  isWithinInvoiceSyncWindow,
  getNextInvoiceSyncSlot,
  getSyncSlotKey,
  runSafeCronJob,
} from '../common/utils/cron.util';
import { GdtCronStateHelper } from './helpers/gdt-cron-state.helper';
import {
  getVietnamTodayIso,
  shiftIsoDate,
} from './helpers/gdt-date-window.helper';

@Injectable()
export class ErpInvoicesCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErpInvoicesCronService.name);
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly erpInvoicesCoreService: ErpInvoicesCoreService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(CorePermission)
    private readonly permissionRepo: Repository<CorePermission>,
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepo: Repository<CoreUserRole>,
  ) {}

  onModuleInit() {
    if (!isGdtInvoiceCronEnabled()) {
      this.logger.log(
        'ErpInvoices GDT auto-sync cron is disabled (ENABLE_INVOICE_CRON=false).',
      );
      return;
    }

    const { nextSlotDate, slotLabel } = getNextInvoiceSyncSlot();
    this.logger.log(
      `ErpInvoices GDT auto-sync activated. Next sync slot scheduled at ${slotLabel} (${nextSlotDate.toISOString()}).`,
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
   * Khôi phục tiến trình tự động đồng bộ khi người dùng cập nhật thông tin/mật khẩu mới
   */
  public resumeAfterPasswordUpdate() {
    GdtCronStateHelper.resume();
    this.logger.log(
      'Tự động đồng bộ Cổng Thuế GDT đã được mở khóa lại sau khi cập nhật mật khẩu mới.',
    );
  }

  public isAuthPaused(): boolean {
    return GdtCronStateHelper.isPaused();
  }

  private async checkAndTriggerScheduledSync() {
    if (this.isRunning) return;

    if (!isGdtInvoiceCronEnabled() || GdtCronStateHelper.isPaused()) {
      return;
    }

    const now = new Date();
    if (!isWithinInvoiceSyncWindow(now)) {
      return;
    }

    const { key, label } = getSyncSlotKey(now);
    if (GdtCronStateHelper.getLastExecutedSlotKey() === key) {
      return; // Đã chạy xong cho khung giờ này
    }

    GdtCronStateHelper.setLastExecutedSlotKey(key);
    this.logger.log(
      `Triggering scheduled invoice sync for slot ${label} (${key})...`,
    );

    await this.autoSyncCurrentMonth();
  }

  async autoSyncCurrentMonth() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await runSafeCronJob({
        jobName: 'GdtInvoiceSync',
        logger: this.logger,
        checkEnabled: () => isGdtInvoiceCronEnabled(),
        isPaused: () => GdtCronStateHelper.isPaused(),
        onAuthError: async (err) => {
          GdtCronStateHelper.pauseDueToAuthError();
          await this.notifyPasswordError(err?.message);
        },
        onError: async (err) => {
          this.logger.error('Error during GDT auto-sync', err);
        },
        execute: async () => {
          const config = await this.erpInvoicesCoreService.getPortalConfig();
          let token = config.token;
          let cookies: string | undefined = config.cookies;

          let isValid = token
            ? await this.erpInvoicesCoreService.checkTokenValid(token, cookies)
            : false;

          if (!isValid) {
            this.logger.log(
              'Token GDT không tồn tại hoặc đã hết hạn. Đang tự động đăng nhập lại Cổng Thuế...',
            );
            const reAuth =
              await this.erpInvoicesCoreService.autoReloginWithRetry();
            if (reAuth) {
              token = reAuth.token;
              cookies = reAuth.cookies;
              isValid = true;
              this.logger.log(
                'Tự động đăng nhập lại Cổng Thuế thành công trong tiến trình Cron.',
              );
            } else {
              this.logger.warn(
                'Tự động đăng nhập lại Cổng Thuế thất bại. Tạm dừng đồng bộ để bảo vệ tài khoản.',
              );
              await this.notifyTokenExpired();
              return;
            }
          }

          // Quét lùi nhiều ngày (theo giờ VN) để bắt hóa đơn lập muộn, kể cả qua ranh giới tháng.
          const dateTo = getVietnamTodayIso();
          const dateFrom = shiftIsoDate(dateTo, -this.getLookbackDays());

          this.logger.log(
            `Syncing IN invoices from ${dateFrom} to ${dateTo}...`,
          );
          let purchaseResult: any = null;
          let purchaseError: unknown = null;
          try {
            purchaseResult = await this.erpInvoicesCoreService.syncFromPortal(
              {
                type: 'purchase',
                dateFrom,
                dateTo,
                token,
                cookies,
              },
              undefined,
              true,
            );
          } catch (err) {
            // Lỗi xác thực phải được xử lý ở onAuthError (tạm dừng cron).
            if (isAuthError(err)) throw err;
            purchaseError = err;
            this.logger.error(
              'IN invoice sync failed, continuing with OUT',
              err,
            );
          }

          // Wait 5 seconds to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 5000));

          this.logger.log(
            `Syncing OUT invoices from ${dateFrom} to ${dateTo}...`,
          );
          let soldResult: any = null;
          let soldError: unknown = null;
          try {
            soldResult = await this.erpInvoicesCoreService.syncFromPortal(
              {
                type: 'sold',
                dateFrom,
                dateTo,
                token,
                cookies,
              },
              undefined,
              true,
            );
          } catch (err) {
            if (isAuthError(err)) throw err;
            soldError = err;
            this.logger.error('OUT invoice sync failed', err);
          }

          await this.notifySyncIncomplete(purchaseResult, soldResult, [
            purchaseError,
            soldError,
          ]);
          this.logger.log('Auto-sync finished.');
          await this.notifySyncSuccess(purchaseResult, soldResult);
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
          title: 'Tạm dừng đồng bộ Cổng Thuế GDT (Sai mật khẩu)',
          message: `Hệ thống phát hiện thông tin đăng nhập Cổng Thuế GDT không chính xác (${details || 'Sai mật khẩu/tài khoản'}). Tiến trình tự động đồng bộ đã tạm dừng ngay lập tức để bảo vệ tài khoản tránh bị khóa. Vui lòng vào Cài đặt để cập nhật lại mật khẩu đúng.`,
        });
      }
    } catch (e) {
      this.logger.error('Failed to send password error notification', e);
    }
  }

  private async notifyTokenExpired() {
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
          title: 'Token GDT hóa đơn hết hạn',
          message:
            'Vui lòng đăng nhập lại tại hoadondientu.gdt.gov.vn hoặc lưu lại mật khẩu trong hệ thống để tự động đồng bộ.',
        });
      }
    } catch (e) {
      this.logger.error('Failed to send token expiration notifications', e);
    }
  }

  private async notifySyncSuccess(purchaseStats: any, soldStats: any) {
    const totalImported =
      (purchaseStats?.imported || 0) + (soldStats?.imported || 0);
    if (totalImported <= 0) return;

    const totalFetched =
      (purchaseStats?.totalItemsFetched || 0) +
      (soldStats?.totalItemsFetched || 0);

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
          title: 'Đồng bộ hóa đơn thành công',
          message: `Hệ thống vừa đồng bộ và kiểm tra ${totalFetched} hóa đơn. Có ${totalImported} hóa đơn được thêm mới vào phần mềm. Sổ cái phụ tùng FIFO cũng đang được tự động tính toán lại.`,
        });
      }
    } catch (e) {
      this.logger.error('Failed to send sync success notifications', e);
    }
  }

  /** Số ngày quét lùi mỗi lượt, cấu hình qua GDT_CRON_LOOKBACK_DAYS (mặc định 35). */
  private getLookbackDays(): number {
    const days = Number(process.env.GDT_CRON_LOOKBACK_DAYS ?? 35);
    return Number.isFinite(days) && days >= 1 ? Math.floor(days) : 35;
  }

  /** Thông báo khi một lượt đồng bộ có phần lỗi, cửa sổ phải chia nhỏ, xung đột số tiền hoặc lỗi chiều. */
  private async notifySyncIncomplete(
    purchaseStats: any,
    soldStats: any,
    errors: unknown[],
  ) {
    const problems: string[] = [];
    const sides: [string, any][] = [
      ['mua vào', purchaseStats],
      ['bán ra', soldStats],
    ];
    for (const [label, stats] of sides) {
      const failed = stats?.failedSegments?.length ?? 0;
      const truncated = stats?.truncatedWindows ?? 0;
      const conflicts = stats?.identityConflicts?.length ?? 0;
      if (failed) problems.push(`${label}: ${failed} phần lỗi`);
      if (truncated)
        problems.push(`${label}: ${truncated} cửa sổ phải chia nhỏ`);
      if (conflicts)
        problems.push(`${label}: ${conflicts} hóa đơn cùng số nhưng khác tiền`);
    }
    for (const err of errors) {
      if (err)
        problems.push(
          `lỗi: ${err instanceof Error ? err.message : 'không xác định'}`,
        );
    }
    if (problems.length === 0) return;

    this.logger.warn(`Đồng bộ hóa đơn chưa đầy đủ: ${problems.join('; ')}`);

    try {
      const userIds = await this.findInvoiceNotifyUserIds();
      for (const userId of userIds) {
        await this.notificationsService.createForUser(userId, {
          type: 'WARNING',
          title: 'Đồng bộ hóa đơn chưa đầy đủ',
          message: `Lượt đồng bộ Cổng Thuế có vấn đề: ${problems.join('; ')}. Các hóa đơn còn thiếu sẽ được quét lại ở lượt sau.`,
        });
      }
    } catch (e) {
      this.logger.error('Failed to send incomplete sync notifications', e);
    }
  }

  /** Người dùng có quyền xem hóa đơn (resource `invoices` hoặc `*`). */
  private async findInvoiceNotifyUserIds(): Promise<string[]> {
    const perms = await this.permissionRepo.find({
      where: [{ resource: 'invoices' }, { resource: '*' }],
    });
    const roleIds = [...new Set(perms.map((p) => p.roleId))];
    if (roleIds.length === 0) return [];

    const userRoles = await this.userRoleRepo.find({
      where: { roleId: In(roleIds) },
    });
    return [...new Set(userRoles.map((ur) => ur.userId))];
  }
}
