import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import { AuditLog } from '../entities/audit-log.entity';
import { isAuditLogEnabled } from '../helpers/audit-enabled';

export const AUDIT_RETENTION_JOB_NAME = 'audit-logs-retention';
/** 02:00 mỗi ngày, giờ Việt Nam. */
export const AUDIT_RETENTION_CRON = '0 0 2 * * *';
export const AUDIT_RETENTION_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const AUDIT_RETENTION_BATCH = 2000;
export const DEFAULT_AUDIT_RETENTION_DAYS = 30;

/** Đọc `AUDIT_LOG_RETENTION_DAYS`; giá trị thiếu hoặc không hợp lệ thì dùng mặc định 30 ngày. */
export function resolveAuditRetentionDays(raw: string | undefined): number {
  const parsed = Number(raw);
  return raw && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_AUDIT_RETENTION_DAYS;
}

/**
 * Xóa nhật ký quá hạn theo lô nhỏ (không khóa bảng). Kế thừa `ScheduledJob`;
 * `scheduler-jobs` tự đăng ký, bật/tắt theo cổng `isCronEnabled()`.
 */
@Injectable()
export class AuditRetentionJob extends ScheduledJob {
  readonly jobName = AUDIT_RETENTION_JOB_NAME;
  readonly cron = AUDIT_RETENTION_CRON;
  readonly timeZone = AUDIT_RETENTION_TIMEZONE;
  private readonly logger = new Logger(AuditRetentionJob.name);
  private isRunning = false;

  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>,
    @Optional() private readonly configService?: ConfigService,
  ) {
    super();
  }

  /** Trả về số dòng đã xóa. */
  async run(): Promise<number> {
    if (!isAuditLogEnabled(this.configService)) {
      this.logger.log('Audit log đang tắt (ENABLE_AUDIT_LOG=false), bỏ qua.');
      return 0;
    }
    if (this.isRunning) {
      this.logger.warn('Retention audit đang chạy, bỏ qua chu kỳ này.');
      return 0;
    }
    this.isRunning = true;
    const days = resolveAuditRetentionDays(
      this.configService?.get<string>('AUDIT_LOG_RETENTION_DAYS') ??
        process.env.AUDIT_LOG_RETENTION_DAYS,
    );
    let total = 0;
    try {
      let deleted: number;
      do {
        const result = await this.repository.query(
          `DELETE FROM audit_logs WHERE id IN (
             SELECT id FROM audit_logs
             WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
             LIMIT $2)`,
          [days, AUDIT_RETENTION_BATCH],
        );
        deleted = Number(result?.[1] ?? 0);
        total += deleted;
      } while (deleted >= AUDIT_RETENTION_BATCH);
      this.logger.log(
        `Retention audit xong: xóa ${total} dòng quá ${days} ngày.`,
      );
    } catch (err) {
      this.logger.error(
        `Lỗi retention audit: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.isRunning = false;
    }
    return total;
  }
}
