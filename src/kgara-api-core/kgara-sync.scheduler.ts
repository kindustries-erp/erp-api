import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KgaraBranch } from './entities/kgara_branch.entity';
import { KgaraSyncService } from './kgara-sync.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CoreUser } from '../users/entities/core-user.entity';
import {
  isCronEnabled,
  getNextSyncSlot,
  runSafeCronJob,
} from '../common/utils/cron.util';

@Injectable()
export class KgaraSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(KgaraSyncScheduler.name);

  constructor(
    @InjectRepository(KgaraBranch)
    private branchRepo: Repository<KgaraBranch>,
    @InjectRepository(CoreUser)
    private userRepo: Repository<CoreUser>,
    private syncService: KgaraSyncService,
    private notificationsService: NotificationsService,
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
  }

  /**
   * Đồng bộ vụ việc dịch vụ KGara tại 3 mốc cố định: 03:15, 09:15, 15:15 (Asia/Ho_Chi_Minh)
   * Tránh khung giờ backup DB đêm (00h - 03h) và các mốc giờ chẵn.
   */
  @Cron('0 15 3,9,15 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runScheduledSyncCheck() {
    await runSafeCronJob({
      jobName: 'KgaraCaseSync',
      logger: this.logger,
      checkEnabled: () => isCronEnabled(),
      onError: async (error) => {
        try {
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
        } catch (notifyErr: any) {
          this.logger.error(
            `Không thể gửi thông báo lỗi KGara tới Admin: ${notifyErr?.message}`,
          );
        }
      },
      execute: async () => {
        this.logger.log('Starting scheduled Kgara sync check...');
        const branches = await this.branchRepo.find();
        const adminUsers = await this.userRepo
          .createQueryBuilder('user')
          .innerJoin('user.role', 'role')
          .where('role.name = :roleName', { roleName: 'admin' })
          .getMany();

        let totalDeleted = 0;
        let totalWithInvoices = 0;

        const now = new Date();
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
          `Scheduled Kgara sync check completed. Deleted: ${totalDeleted}, With Invoices: ${totalWithInvoices}`,
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

        return { totalDeleted, totalWithInvoices };
      },
    });
  }

  /** Alias tương thích ngược cho các spec test hoặc lời gọi cũ */
  async runHourlySyncCheck() {
    return this.runScheduledSyncCheck();
  }
}
