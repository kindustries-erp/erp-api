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

@Injectable()
export class ErpInvoicesCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ErpInvoicesCronService.name);
  private timeoutId: NodeJS.Timeout;

  constructor(
    private readonly erpInvoicesCoreService: ErpInvoicesCoreService,
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

    this.logger.log(`Next auto-sync scheduled in ${nextMinutes} minutes.`);

    this.timeoutId = setTimeout(() => {
      this.autoSyncCurrentMonth().finally(() => {
        this.scheduleNextSync();
      });
    }, nextMs);
  }

  async autoSyncCurrentMonth() {
    this.logger.log('Auto-sync started for current month.');

    try {
      const token = await this.erpInvoicesCoreService.getPortalToken();
      if (!token) {
        this.logger.warn('No GDT portal token found. Skipping auto-sync.');
        return;
      }

      const isValid = await this.erpInvoicesCoreService.checkTokenValid(token);
      if (!isValid) {
        this.logger.warn('GDT portal token is invalid/expired.');
        await this.notifyTokenExpired();
        return;
      }

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

      const dateFrom = this.formatDate(firstDay);
      const dateTo = this.formatDate(now);

      this.logger.log(`Syncing IN invoices from ${dateFrom} to ${dateTo}...`);
      await this.erpInvoicesCoreService.syncFromPortal(
        {
          type: 'purchase',
          dateFrom,
          dateTo,
        },
        undefined, // no specific user
      );

      // Wait 5 seconds to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 5000));

      this.logger.log(`Syncing OUT invoices from ${dateFrom} to ${dateTo}...`);
      await this.erpInvoicesCoreService.syncFromPortal(
        {
          type: 'sold',
          dateFrom,
          dateTo,
        },
        undefined,
      );

      this.logger.log('Auto-sync finished successfully.');
    } catch (e: any) {
      if (e.message === 'GDT_TOKEN_EXPIRED') {
        this.logger.warn('Token expired during sync.');
        await this.notifyTokenExpired();
      } else {
        this.logger.error('Error during auto-sync', e);
      }
    }
  }

  private async notifyTokenExpired() {
    try {
      // Find roles that have permission to 'invoices' or '*'
      const perms = await this.permissionRepo.find({
        where: [{ resource: 'invoices' }, { resource: '*' }],
      });
      const roleIds = [...new Set(perms.map((p) => p.roleId))];

      if (roleIds.length === 0) return;

      // Find users with these roles
      const userRoles = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });
      const userIds = [...new Set(userRoles.map((ur) => ur.userId))];

      for (const userId of userIds) {
        await this.notificationsService.createForUser(userId, {
          type: 'ERROR',
          title: 'Token GDT hóa đơn hết hạn',
          message:
            'Vui lòng đăng nhập lại tại hoadondientu.gdt.gov.vn và cập nhật token trong hệ thống để tự động đồng bộ.',
        });
      }
    } catch (e) {
      this.logger.error('Failed to send token expiration notifications', e);
    }
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${date}/${m}/${y}`;
  }
}
