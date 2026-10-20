import { randomUUID } from 'crypto';

import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';

export type ExportJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export type ExportProgressEvent = {
  processId: string;
  userId?: string;
  jobId?: string;
  current: number;
  total: number;
  isRunning: boolean;
  completed: boolean;
  ready: boolean;
  failed: boolean;
  message?: string;
  fileName?: string;
};

export type ExportHistoryItem = {
  jobId: string;
  fileName: string;
  status: ExportJobStatus;
  current: number;
  total: number;
  message: string;
  createdAt: string;
  finishedAt?: string;
  expiresAt?: string;
  dateFrom?: string;
  dateTo?: string;
  canDownload: boolean;
};

export type ExportHistoryResult = {
  items: ExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ExportStartResult = {
  jobId: string;
  message: string;
  reused?: boolean;
};

export type ExportProgressReporter = (
  current: number,
  total: number,
  message: string,
) => void;

export type ExportJobProducer = (
  onProgress: ExportProgressReporter,
) => Promise<Buffer | Uint8Array | ArrayBuffer>;

export type ExportJobStartInput = {
  userId: string;
  /** Chuỗi ổn định đại diện bộ lọc, dùng để tái sử dụng file đã tạo. */
  fingerprint: string;
  fileName: string;
  totalUnits: number;
  dateFrom?: string;
  dateTo?: string;
  producer: ExportJobProducer;
};

type ExportJob = {
  id: string;
  userId: string;
  status: ExportJobStatus;
  current: number;
  total: number;
  message: string;
  createdAt: number;
  finishedAt?: number;
  fileName: string;
  fingerprint: string;
  dateFrom?: string;
  dateTo?: string;
  buffer?: Buffer;
  error?: string;
  expiresAt?: number;
};

export type ExportJobRunnerOptions = {
  /** Định danh tiến trình, đi kèm mọi sự kiện SSE (vd: `invoice-xlsx-export`). */
  processId: string;
  ttlMs?: number;
  /**
   * Chỉ tái sử dụng file đã tạo trong khoảng này (ms) kể từ lúc hoàn tất.
   * Mặc định: trong suốt TTL. Dữ liệu đổi nhanh (công nợ) nên đặt ngắn.
   */
  reuseWindowMs?: number;
  cleanupIntervalMs?: number;
};

export const EXPORT_JOB_DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Job nền xuất file chạy trong RAM của process (không bền vững qua restart,
 * không chia sẻ giữa nhiều replica). Mỗi user tối đa 1 job RUNNING; file đã
 * hoàn tất được tái sử dụng khi fingerprint trùng và chưa hết hạn.
 */
export class ExportJobRunner {
  public readonly progress$ = new Subject<ExportProgressEvent>();

  private readonly logger: Logger;
  private readonly ttlMs: number;
  private readonly jobs = new Map<string, ExportJob>();
  private readonly activeJobByUser = new Map<string, string>();
  private readonly cleanupIntervalId: NodeJS.Timeout;

  constructor(private readonly options: ExportJobRunnerOptions) {
    this.logger = new Logger(`ExportJobRunner:${options.processId}`);
    this.ttlMs = options.ttlMs ?? EXPORT_JOB_DEFAULT_TTL_MS;
    this.cleanupIntervalId = setInterval(
      () => this.cleanupExpiredJobs(),
      options.cleanupIntervalMs ?? 60_000,
    );
    this.cleanupIntervalId.unref?.();
  }

  destroy() {
    clearInterval(this.cleanupIntervalId);
    this.progress$.complete();
  }

  start(input: ExportJobStartInput): ExportStartResult {
    const { userId, fingerprint } = input;

    const runningJobId = this.activeJobByUser.get(userId);
    if (runningJobId) {
      const runningJob = this.jobs.get(runningJobId);
      if (runningJob && runningJob.status === 'RUNNING') {
        return {
          jobId: runningJob.id,
          message: 'Đang có một tiến trình xuất Excel đang chạy. Vui lòng đợi.',
        };
      }
    }

    const reusableJob = this.findReusableCompletedJob(userId, fingerprint);
    if (reusableJob) {
      return {
        jobId: reusableJob.id,
        message:
          'Đã tìm thấy file XLSX đã tạo trước đó. Bạn có thể tải lại ngay.',
        reused: true,
      };
    }

    const job: ExportJob = {
      id: randomUUID(),
      userId,
      status: 'RUNNING',
      current: 0,
      total: input.totalUnits,
      message: 'Đang khởi tạo tiến trình xuất Excel...',
      createdAt: Date.now(),
      fileName: input.fileName,
      fingerprint,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    };

    this.jobs.set(job.id, job);
    this.activeJobByUser.set(userId, job.id);

    this.emitJobProgress(job, {
      isRunning: true,
      completed: false,
      ready: false,
      failed: false,
      message: job.message,
    });

    void this.executeJob(job.id, input.producer);

    return {
      jobId: job.id,
      message: 'Tiến trình xuất Excel đang chạy nền.',
      reused: false,
    };
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): ExportHistoryResult {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safePageSize = Number.isFinite(pageSize)
      ? Math.min(100, Math.max(1, Math.floor(pageSize)))
      : 10;

    const allItems = Array.from(this.jobs.values())
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);

    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const offset = (safePage - 1) * safePageSize;

    return {
      items: allItems
        .slice(offset, offset + safePageSize)
        .map((job) => this.toHistoryItem(job)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  getJobSnapshotForUser(userId: string): ExportProgressEvent | null {
    const activeJobId = this.activeJobByUser.get(userId);
    if (!activeJobId) return null;

    const job = this.jobs.get(activeJobId);
    if (!job) return null;

    const completed = job.status === 'COMPLETED';
    const failed = job.status === 'FAILED';

    return {
      processId: this.options.processId,
      userId: job.userId,
      jobId: job.id,
      current: job.current,
      total: job.total,
      isRunning: job.status === 'RUNNING',
      completed,
      ready: completed,
      failed,
      message: failed ? job.error || job.message : job.message,
      fileName: job.fileName,
    };
  }

  getReadyFile(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Không tìm thấy file xuất Excel.');
    }

    if (job.status === 'RUNNING') {
      throw new BadRequestException(
        'File Excel đang được tạo. Vui lòng thử lại sau.',
      );
    }

    if (job.status === 'FAILED') {
      throw new BadRequestException(
        job.error || 'Tiến trình xuất Excel đã thất bại.',
      );
    }

    if (!job.buffer) {
      throw new NotFoundException('Không tìm thấy dữ liệu file xuất Excel.');
    }

    return { buffer: job.buffer, fileName: job.fileName };
  }

  private async executeJob(jobId: string, producer: ExportJobProducer) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const output = await producer((current, total, message) => {
        const activeJob = this.jobs.get(jobId);
        if (!activeJob || activeJob.status !== 'RUNNING') return;

        activeJob.current = current;
        activeJob.total = total;
        activeJob.message = message;

        this.emitJobProgress(activeJob, {
          isRunning: true,
          completed: false,
          ready: false,
          failed: false,
          message,
        });
      });

      const doneJob = this.jobs.get(jobId);
      if (!doneJob) return;

      doneJob.status = 'COMPLETED';
      doneJob.buffer = Buffer.from(output as ArrayBuffer);
      doneJob.current = doneJob.total;
      doneJob.message = 'Đã tạo xong file XLSX. Sẵn sàng tải xuống.';
      doneJob.finishedAt = Date.now();
      doneJob.expiresAt = Date.now() + this.ttlMs;

      this.emitJobProgress(doneJob, {
        isRunning: false,
        completed: true,
        ready: true,
        failed: false,
        message: doneJob.message,
      });
    } catch (error: any) {
      const failedJob = this.jobs.get(jobId);
      if (!failedJob) return;

      const failMessage = error?.message || 'Xuất Excel thất bại';
      failedJob.status = 'FAILED';
      failedJob.error = failMessage;
      failedJob.message = failMessage;
      failedJob.finishedAt = Date.now();

      this.emitJobProgress(failedJob, {
        isRunning: false,
        completed: false,
        ready: false,
        failed: true,
        message: failMessage,
      });

      this.logger.error(`Export background job failed: ${failMessage}`);
    } finally {
      const done = this.jobs.get(jobId);
      if (done && this.activeJobByUser.get(done.userId) === jobId) {
        this.activeJobByUser.delete(done.userId);
      }
    }
  }

  private emitJobProgress(
    job: ExportJob,
    state: Pick<
      ExportProgressEvent,
      'isRunning' | 'completed' | 'ready' | 'failed' | 'message'
    >,
  ) {
    this.progress$.next({
      processId: this.options.processId,
      userId: job.userId,
      jobId: job.id,
      current: job.current,
      total: job.total,
      fileName: job.fileName,
      ...state,
    });
  }

  private cleanupExpiredJobs() {
    const now = Date.now();

    for (const [jobId, job] of this.jobs.entries()) {
      const isExpired = now - (job.finishedAt || job.createdAt) > this.ttlMs;
      const finished = job.status === 'COMPLETED' || job.status === 'FAILED';
      if (finished && isExpired) {
        this.jobs.delete(jobId);
        if (this.activeJobByUser.get(job.userId) === jobId) {
          this.activeJobByUser.delete(job.userId);
        }
      }
    }
  }

  private toHistoryItem(job: ExportJob): ExportHistoryItem {
    const canDownload =
      job.status === 'COMPLETED' &&
      Boolean(job.buffer) &&
      (!job.expiresAt || job.expiresAt > Date.now());

    return {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status,
      current: job.current,
      total: job.total,
      message: job.status === 'FAILED' ? job.error || job.message : job.message,
      createdAt: new Date(job.createdAt).toISOString(),
      finishedAt: job.finishedAt
        ? new Date(job.finishedAt).toISOString()
        : undefined,
      expiresAt: job.expiresAt
        ? new Date(job.expiresAt).toISOString()
        : undefined,
      dateFrom: job.dateFrom,
      dateTo: job.dateTo,
      canDownload,
    };
  }

  private findReusableCompletedJob(userId: string, fingerprint: string) {
    const now = Date.now();
    const reuseWindowMs = this.options.reuseWindowMs;

    return Array.from(this.jobs.values())
      .filter(
        (job) =>
          job.userId === userId &&
          job.status === 'COMPLETED' &&
          Boolean(job.buffer) &&
          job.fingerprint === fingerprint &&
          (!job.expiresAt || job.expiresAt > now) &&
          (reuseWindowMs === undefined ||
            now - (job.finishedAt ?? job.createdAt) <= reuseWindowMs),
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }
}

/** JSON ổn định (khóa sắp xếp) để dựng fingerprint. */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(',')}}`;
}

/** Chuẩn hóa chuỗi JSON (column_filters...) về dạng so sánh được. */
export function normalizeJsonString(input?: string): string {
  if (!input) return '';
  try {
    return stableStringify(JSON.parse(input));
  } catch {
    return input.trim();
  }
}

export function formatExportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
