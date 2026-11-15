import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import { SessionTokenService } from '../services/session-token.service';

export const AUTH_SESSION_CLEANUP_JOB_NAME = 'auth-sessions-cleanup';
/** 03:00 mỗi ngày, giờ Việt Nam. */
export const AUTH_SESSION_CLEANUP_CRON = '0 0 3 * * *';
export const AUTH_SESSION_CLEANUP_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Xóa cứng phiên đã hết hạn. Phiên đã thu hồi nhưng chưa hết hạn được giữ lại
 * để còn phát hiện việc dùng lại token bị thu hồi.
 */
@Injectable()
export class AuthSessionCleanupJob extends ScheduledJob {
  readonly jobName = AUTH_SESSION_CLEANUP_JOB_NAME;
  readonly cron = AUTH_SESSION_CLEANUP_CRON;
  readonly timeZone = AUTH_SESSION_CLEANUP_TIMEZONE;
  private readonly logger = new Logger(AuthSessionCleanupJob.name);

  constructor(private readonly sessions: SessionTokenService) {
    super();
  }

  async run(now: Date = new Date()): Promise<number> {
    const deleted = await this.sessions.purgeExpiredBefore(now);
    this.logger.log(`Đã xóa ${deleted} phiên đăng nhập hết hạn.`);
    return deleted;
  }
}
