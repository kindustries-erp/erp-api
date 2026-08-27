import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpAuditLog } from '../entities/erp-audit-log.entity';

@Injectable()
export class AuditRetentionScheduler {
  private readonly logger = new Logger(AuditRetentionScheduler.name);
  private isRunning = false;

  constructor(
    @InjectRepository(ErpAuditLog)
    private readonly auditRepository: Repository<ErpAuditLog>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Run daily at 02:00 AM to clean up expired audit logs in non-locking batches.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleRetentionCleanup(): Promise<number> {
    if (this.isRunning) {
      this.logger.warn(
        'Audit retention cleanup is already running. Skipping this cycle.',
      );
      return 0;
    }

    this.isRunning = true;
    const retentionDays = Number(
      this.configService.get<string>('AUDIT_LOG_RETENTION_DAYS') || '30',
    );

    this.logger.log(
      `Starting audit logs retention cleanup (retention: ${retentionDays} days)...`,
    );

    let totalDeleted = 0;
    const BATCH_SIZE = 2000;

    try {
      while (true) {
        const result = await this.auditRepository.query(
          `
          DELETE FROM erp_audit_logs
          WHERE id IN (
            SELECT id FROM erp_audit_logs
            WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
            LIMIT $2
          );
        `,
          [retentionDays, BATCH_SIZE],
        );

        const deletedCount = result?.[1] ?? 0;
        totalDeleted += deletedCount;

        if (deletedCount < BATCH_SIZE) {
          break;
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Audit retention cleanup completed: purged ${totalDeleted} expired logs.`,
        );
      } else {
        this.logger.log(
          'Audit retention cleanup completed: 0 expired logs to purge.',
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Error during audit retention cleanup: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isRunning = false;
    }

    return totalDeleted;
  }
}
