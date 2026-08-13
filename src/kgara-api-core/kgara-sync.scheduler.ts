import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CoreUser } from '../users/entities/core-user.entity';

@Injectable()
export class KgaraSyncScheduler {
  private readonly logger = new Logger(KgaraSyncScheduler.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private branchRepo: Repository<KgaraBranch>,
    @InjectRepository(CoreUser)
    private userRepo: Repository<CoreUser>,
    private syncService: KgaraSyncService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourlySyncCheck() {
    this.logger.log('Starting hourly Kgara sync check...');
    try {
      const branches = await this.branchRepo.find();
      const adminUsers = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.name = :roleName', { roleName: 'admin' })
        .getMany();

      let totalDeleted = 0;
      let totalWithInvoices = 0;

      const now = new Date();
      const firstDayLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const lastDayThisMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      );

      const from = firstDayLastMonth.toLocaleDateString('en-CA');
      const to = lastDayThisMonth.toLocaleDateString('en-CA');

      for (const branch of branches) {
        if (!branch.externalId) continue;
        this.logger.log(
          `Checking deletion for branch ${branch.externalId} (${from} to ${to})`,
        );

        // Use incremental sync up to the current watermark for this branch
        const watermark = await this.syncService.getIncrementalWatermark(
          branch.externalId,
          '/api/v1/gr/cases/list',
        );

        // syncCasesForBranch will internally call detectAndMarkDeletedCases because from and to are provided
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
      }

      this.logger.log(
        `Hourly sync check completed. Deleted: ${totalDeleted}, With Invoices: ${totalWithInvoices}`,
      );

      // Notify admins if there are changes
      if (totalDeleted > 0) {
        for (const admin of adminUsers) {
          if (totalWithInvoices > 0) {
            await this.notificationsService.createForUser(admin.id, {
              title: 'Kgara Sync Alert',
              message: `Phát hiện ${totalDeleted} phiếu bị xóa trên Kgara. Trong đó có ${totalWithInvoices} phiếu đang có chứng từ liên kết cần xử lý.`,
              type: 'WARNING',
            });
          } else {
            await this.notificationsService.createForUser(admin.id, {
              title: 'Kgara Sync Info',
              message: `Phát hiện ${totalDeleted} phiếu bị xóa trên Kgara. Không có chứng từ liên kết bị ảnh hưởng.`,
              type: 'INFO',
            });
          }
        }
      }
    } catch (error: any) {
      this.logger.error('Hourly sync check failed', error.stack);

      const adminUsers = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user.role', 'role')
        .where('role.name = :roleName', { roleName: 'admin' })
        .getMany();

      for (const admin of adminUsers) {
        await this.notificationsService.createForUser(admin.id, {
          title: 'Kgara Sync Error',
          message: `Lỗi khi chạy đồng bộ tự động Kgara: ${error.message}`,
          type: 'ERROR',
        });
      }
    }
  }
}
