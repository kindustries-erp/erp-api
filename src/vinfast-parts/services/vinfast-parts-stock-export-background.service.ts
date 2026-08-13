import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Subject } from 'rxjs';

export type VinfastPartsStockExportQuery = {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  sorts?: string;
  columnSearch?: string;
  columnFilters?: string;
  vehicleType?: string;
};

export type VinfastPartsStockExportProgressEvent = {
  processId: 'vinfast-parts-stock-xlsx-export' | 'ping';
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

export type VinfastPartsStockExportHistoryItem = {
  jobId: string;
  fileName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
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

export type VinfastPartsStockExportHistoryResult = {
  items: VinfastPartsStockExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type VinfastPartsStockExportJob = {
  id: string;
  userId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  current: number;
  total: number;
  message: string;
  createdAt: number;
  finishedAt?: number;
  fileName: string;
  queryFingerprint: string;
  dateFrom?: string;
  dateTo?: string;
  buffer?: Buffer;
  error?: string;
  expiresAt?: number;
};

@Injectable()
export class VinfastPartsStockExportBackgroundService implements OnModuleDestroy {
  private static readonly HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

  public readonly progress$ =
    new Subject<VinfastPartsStockExportProgressEvent>();

  private readonly jobs = new Map<string, VinfastPartsStockExportJob>();
  private readonly activeJobByUser = new Map<string, string>();
  private readonly cleanupIntervalId: NodeJS.Timeout;

  constructor() {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
    this.progress$.complete();
  }

  async startBackgroundExport(
    query: VinfastPartsStockExportQuery,
    userId: string,
    executor: (
      onProgress: (current: number, total: number, message: string) => void,
    ) => Promise<Buffer>,
  ) {
    if (!userId) {
      throw new BadRequestException('Thiếu thông tin người dùng đăng nhập.');
    }

    const queryFingerprint = this.buildQueryFingerprint(query);

    const runningJobId = this.activeJobByUser.get(userId);
    if (runningJobId) {
      const runningJob = this.jobs.get(runningJobId);
      if (runningJob && runningJob.status === 'RUNNING') {
        return {
          jobId: runningJob.id,
          message:
            'Đang có một tiến trình tải bảng kê đang chạy. Vui lòng đợi.',
          reused: false,
        };
      }
    }

    const reusableJob = this.findReusableCompletedJob(userId, queryFingerprint);
    if (reusableJob) {
      return {
        jobId: reusableJob.id,
        message:
          'Đã tìm thấy file bảng kê đã tạo trước đó. Bạn có thể tải lại ngay.',
        reused: true,
      };
    }

    const now = new Date();
    const fileName = `Bao_cao_phu_tung_VINFAST_${this.formatDateForFileName(now)}.xlsx`;

    const job: VinfastPartsStockExportJob = {
      id: randomUUID(),
      userId,
      status: 'RUNNING',
      current: 0,
      total: 100,
      message: 'Đang khởi tạo tiến trình tải bảng kê...',
      createdAt: Date.now(),
      fileName,
      queryFingerprint,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };

    this.jobs.set(job.id, job);
    this.activeJobByUser.set(userId, job.id);

    this.emitJobProgress(job, {
      message: job.message,
      isRunning: true,
      completed: false,
      ready: false,
      failed: false,
    });

    void this.executeJob(job.id, executor);

    return {
      jobId: job.id,
      message: 'Tiến trình tải bảng kê đang chạy nền.',
      reused: false,
    };
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): VinfastPartsStockExportHistoryResult {
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
    const slice = allItems.slice(offset, offset + safePageSize);

    return {
      items: slice.map((job) => this.toHistoryItem(job)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages,
    };
  }

  getJobSnapshotForUser(
    userId: string,
  ): VinfastPartsStockExportProgressEvent | null {
    const activeJobId = this.activeJobByUser.get(userId);
    if (!activeJobId) return null;

    const job = this.jobs.get(activeJobId);
    if (!job) return null;

    const isRunning = job.status === 'RUNNING';
    const completed = job.status === 'COMPLETED';
    const failed = job.status === 'FAILED';

    return {
      processId: 'vinfast-parts-stock-xlsx-export',
      userId: job.userId,
      jobId: job.id,
      current: job.current,
      total: job.total,
      isRunning,
      completed,
      ready: completed,
      failed,
      message: failed ? job.error || job.message : job.message,
      fileName: job.fileName,
    };
  }

  getReadyExportFile(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Không tìm thấy file bảng kê.');
    }

    if (job.status === 'RUNNING') {
      throw new BadRequestException(
        'File bảng kê đang được tạo. Vui lòng thử lại sau.',
      );
    }

    if (job.status === 'FAILED') {
      throw new BadRequestException(
        job.error || 'Tiến trình tải bảng kê đã thất bại.',
      );
    }

    if (!job.buffer) {
      throw new NotFoundException('Không tìm thấy dữ liệu file bảng kê.');
    }

    return {
      buffer: job.buffer,
      fileName: job.fileName,
    };
  }

  private async executeJob(
    jobId: string,
    executor: (
      onProgress: (current: number, total: number, message: string) => void,
    ) => Promise<Buffer>,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const buffer = await executor((current, total, message) => {
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
      doneJob.buffer = Buffer.from(buffer);
      doneJob.current = doneJob.total;
      doneJob.message = 'Đã tạo xong file bảng kê. Sẵn sàng tải xuống.';
      doneJob.finishedAt = Date.now();
      doneJob.expiresAt =
        Date.now() + VinfastPartsStockExportBackgroundService.HISTORY_TTL_MS;

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

      const failMessage = error?.message || 'Tải bảng kê thất bại';
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
    } finally {
      const done = this.jobs.get(jobId);
      if (done) {
        this.activeJobByUser.delete(done.userId);
      }
    }
  }

  private emitJobProgress(
    job: VinfastPartsStockExportJob,
    state: {
      isRunning: boolean;
      completed: boolean;
      ready: boolean;
      failed: boolean;
      message: string;
    },
  ) {
    this.progress$.next({
      processId: 'vinfast-parts-stock-xlsx-export',
      userId: job.userId,
      jobId: job.id,
      current: job.current,
      total: job.total,
      isRunning: state.isRunning,
      completed: state.completed,
      ready: state.ready,
      failed: state.failed,
      message: state.message,
      fileName: job.fileName,
    });
  }

  private cleanupExpiredJobs() {
    const now = Date.now();
    const ttlMs = VinfastPartsStockExportBackgroundService.HISTORY_TTL_MS;

    for (const [jobId, job] of this.jobs.entries()) {
      const isExpired = now - (job.finishedAt || job.createdAt) > ttlMs;
      const finished = job.status === 'COMPLETED' || job.status === 'FAILED';
      if (finished && isExpired) {
        this.jobs.delete(jobId);
        if (this.activeJobByUser.get(job.userId) === jobId) {
          this.activeJobByUser.delete(job.userId);
        }
      }
    }
  }

  private toHistoryItem(
    job: VinfastPartsStockExportJob,
  ): VinfastPartsStockExportHistoryItem {
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

  private findReusableCompletedJob(userId: string, queryFingerprint: string) {
    const now = Date.now();

    return Array.from(this.jobs.values())
      .filter(
        (job) =>
          job.userId === userId &&
          job.status === 'COMPLETED' &&
          Boolean(job.buffer) &&
          job.queryFingerprint === queryFingerprint &&
          (!job.expiresAt || job.expiresAt > now),
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  private buildQueryFingerprint(query: VinfastPartsStockExportQuery) {
    const normalized = {
      dateFrom: query.dateFrom || '',
      dateTo: query.dateTo || '',
      search: (query.search || '').trim(),
      sortBy: (query.sortBy || '').trim(),
      sortDir: (query.sortDir || '').trim(),
      sorts: this.normalizeJsonString(query.sorts),
      columnSearch: this.normalizeJsonString(query.columnSearch),
      columnFilters: this.normalizeJsonString(query.columnFilters),
      vehicleType: query.vehicleType || '',
    };

    return this.stableStringify(normalized);
  }

  private normalizeJsonString(input?: string) {
    if (!input) return '';
    try {
      return this.stableStringify(JSON.parse(input));
    } catch {
      return input.trim();
    }
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${this.stableStringify(obj[key])}`,
    );
    return `{${entries.join(',')}}`;
  }

  private formatDateForFileName(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}${m}${d}_${h}${mi}${s}`;
  }
}
