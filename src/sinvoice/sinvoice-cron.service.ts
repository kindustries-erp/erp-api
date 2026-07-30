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

@Injectable()
export class SinvoiceCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SinvoiceCronService.name);
  private timeoutId: NodeJS.Timeout;

  constructor(
    private readonly sinvoiceService: SinvoiceService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(CorePermission)
    private readonly permissionRepo: Repository<CorePermission>,
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepo: Repository<CoreUserRole>,
  ) {}

  onModuleInit() {
    this.scheduleNextSync();
  }

  onModuleDestroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private scheduleNextSync() {
    const minMinutes = 30;
    const maxMinutes = 45;
    const nextMinutes =
      Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    const nextMs = nextMinutes * 60 * 1000;

    this.logger.log(
      `Next auto-sync draft scheduled in ${nextMinutes} minutes.`,
    );

    this.timeoutId = setTimeout(() => {
      this.autoSyncDrafts().finally(() => {
        this.scheduleNextSync();
      });
    }, nextMs);
  }

  async autoSyncDrafts() {
    this.logger.log('Auto-sync draft started.');

    try {
      // Gọi service để đồng bộ hóa đơn nháp
      const res = await this.sinvoiceService.syncDraftsFromViettel();

      this.logger.log('Auto-sync draft finished successfully.');

      // Nếu có hóa đơn mới thì thông báo
      if (res && res.synced > 0) {
        await this.notifySyncSuccess(res.synced);
      }
    } catch (e: any) {
      this.logger.error('Error during draft auto-sync', e);
    }
  }

  private async notifySyncSuccess(syncedCount: number) {
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
          message: `Hệ thống vừa cập nhật thành công ${syncedCount} hóa đơn nháp mới từ Viettel SInvoice.`,
        });
      }
    } catch (e) {
      this.logger.error('Failed to send draft sync success notifications', e);
    }
  }
}
