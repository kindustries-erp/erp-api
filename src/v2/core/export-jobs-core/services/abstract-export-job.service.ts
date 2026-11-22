import { BadRequestException, OnModuleDestroy } from '@nestjs/common';

import type {
  ExportHistoryResult,
  ExportJobRunnerOptions,
  ExportJobStartInput,
  ExportProgressEvent,
  ExportStartResult,
} from '../types/export-job.types';

import { ExportJobRunner } from './export-job-runner';

/**
 * Nền cho service job xuất file nền của một module. Module kế thừa chỉ khai
 * báo `processId` (và tuỳ chọn TTL, cửa sổ reuse), dựng `fingerprint`, `fileName`
 * và `producer` (hàm sinh buffer sẵn có). Toàn bộ trạng thái job, tiến độ SSE,
 * tái sử dụng file và dọn hết hạn nằm ở `ExportJobRunner`.
 */
export abstract class AbstractExportJobService implements OnModuleDestroy {
  protected readonly runner: ExportJobRunner;

  public readonly progress$;

  protected constructor(options: ExportJobRunnerOptions) {
    this.runner = new ExportJobRunner(options);
    this.progress$ = this.runner.progress$;
  }

  onModuleDestroy(): void {
    this.runner.destroy();
  }

  protected startJob(input: ExportJobStartInput): ExportStartResult {
    if (!input.userId) {
      throw new BadRequestException('Thiếu thông tin người dùng đăng nhập.');
    }
    return this.runner.start(input);
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): ExportHistoryResult {
    return this.runner.listHistoryForUser(userId, page, pageSize);
  }

  getJobSnapshotForUser(userId: string): ExportProgressEvent | null {
    return this.runner.getJobSnapshotForUser(userId);
  }

  getReadyFile(jobId: string, userId: string) {
    return this.runner.getReadyFile(jobId, userId);
  }
}
