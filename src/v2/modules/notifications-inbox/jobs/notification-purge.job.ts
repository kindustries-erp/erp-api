import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import { NotificationInboxCommandService } from '../services/notification-inbox-command.service';

export const NOTIFICATION_PURGE_JOB_NAME = 'notifications-purge';
/** 02:30 mỗi ngày, giờ Việt Nam (so le với audit-retention lúc 02:00). */
export const NOTIFICATION_PURGE_CRON = '0 30 2 * * *';
export const NOTIFICATION_PURGE_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const DEFAULT_PURGE_RETENTION_DAYS = 90;

/**
 * Đọc `NOTIFICATION_PURGE_RETENTION_DAYS`. Giá trị thiếu, không phải số nguyên dương thì dùng mặc định.
 */
export function resolveRetentionDays(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_PURGE_RETENTION_DAYS;
  }
  return parsed;
}

/**
 * Job xóa cứng thông báo đã xóa mềm quá N ngày. Kế thừa `ScheduledJob`;
 * `job-scheduler` tự đăng ký, việc bật/tắt do cổng `isCronEnabled()` quyết định.
 */
@Injectable()
export class NotificationPurgeJob extends ScheduledJob {
  readonly jobName = NOTIFICATION_PURGE_JOB_NAME;
  readonly cron = NOTIFICATION_PURGE_CRON;
  readonly timeZone = NOTIFICATION_PURGE_TIMEZONE;
  private readonly logger = new Logger(NotificationPurgeJob.name);

  constructor(private readonly command: NotificationInboxCommandService) {
    super();
  }

  /** Một lần chạy: xóa cứng các dòng đã xóa mềm trước mốc `now - N ngày`. */
  async run(now: Date = new Date()): Promise<number> {
    const days = resolveRetentionDays(
      process.env.NOTIFICATION_PURGE_RETENTION_DAYS,
    );
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const deleted = await this.command.purgeSoftDeletedBefore(cutoff);
    this.logger.log(
      `Đã xóa cứng ${deleted} thông báo đã xóa mềm trước ${cutoff.toISOString()} (giữ ${days} ngày).`,
    );
    return deleted;
  }
}
