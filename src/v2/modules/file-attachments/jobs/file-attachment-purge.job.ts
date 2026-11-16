import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJob } from '@/v2/core/scheduler-core';
import {
  FileAttachmentPurgeService,
  MAX_PURGE_BATCH,
} from '../services/file-attachment-purge.service';
import { FileAttachmentQueryService } from '../services/file-attachment-query.service';
import { FileAttachmentSettingsService } from '../services/file-attachment-settings.service';

export const FILE_ATTACHMENT_PURGE_JOB_NAME = 'file-attachments-purge';
/** 03:15 mỗi ngày, giờ Việt Nam (so le với audit-retention 02:00 và notifications-purge 02:30). */
export const FILE_ATTACHMENT_PURGE_CRON = '0 15 3 * * *';
export const FILE_ATTACHMENT_PURGE_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Giới hạn số lô mỗi lần chạy để một lần chạy không kéo dài vô hạn. */
export const MAX_BATCHES_PER_RUN = 20;

/**
 * Tự dọn file đã xóa mềm quá N ngày. Mặc định TẮT: mỗi lần chạy đọc cài đặt,
 * `auto_purge_enabled = false` thì thoát ngay, không xóa gì.
 */
@Injectable()
export class FileAttachmentPurgeJob extends ScheduledJob {
  readonly jobName = FILE_ATTACHMENT_PURGE_JOB_NAME;
  readonly cron = FILE_ATTACHMENT_PURGE_CRON;
  readonly timeZone = FILE_ATTACHMENT_PURGE_TIMEZONE;
  private readonly logger = new Logger(FileAttachmentPurgeJob.name);

  constructor(
    private readonly settings: FileAttachmentSettingsService,
    private readonly query: FileAttachmentQueryService,
    private readonly purge: FileAttachmentPurgeService,
  ) {
    super();
  }

  /** Trả số file đã xóa cứng. */
  async run(now: Date = new Date()): Promise<number> {
    const config = await this.settings.get();
    if (!config.autoPurgeEnabled) {
      this.logger.log('Tự động dọn file đang tắt, bỏ qua.');
      return 0;
    }
    const cutoff = new Date(
      now.getTime() - config.retentionDays * 24 * 60 * 60 * 1000,
    );
    let purged = 0;
    let skipped = 0;
    for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
      const ids = await this.query.findDueForPurge(cutoff, MAX_PURGE_BATCH);
      if (!ids.length) break;
      const result = await this.purge.purge(ids, {
        userId: null,
        source: 'JOB',
      });
      purged += result.purged.length;
      skipped = result.skipped.length;
      if (!result.purged.length) break;
    }
    this.logger.log(
      `Đã xóa cứng ${purged} file đã xóa mềm trước ${cutoff.toISOString()} (giữ ${config.retentionDays} ngày); còn ${skipped} file bị bỏ qua ở lô cuối.`,
    );
    return purged;
  }
}
