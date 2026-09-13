import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Subject } from 'rxjs';
import { randomUUID } from 'crypto';

import type { ErpInvoiceQuery } from '../erp-invoices-core.service';
import { InvoiceQueryService } from './invoice-query.service';

export type InvoiceExportProgressEvent = {
  processId: 'invoice-xlsx-export' | 'ping';
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

export type InvoiceExportHistoryItem = {
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

export type InvoiceExportHistoryResult = {
  items: InvoiceExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type InvoiceExportJob = {
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
export class InvoiceExportBackgroundService implements OnModuleDestroy {
  private static readonly HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

  private readonly logger = new Logger(InvoiceExportBackgroundService.name);
  public readonly progress$ = new Subject<InvoiceExportProgressEvent>();

  private readonly jobs = new Map<string, InvoiceExportJob>();
  private readonly activeJobByUser = new Map<string, string>();
  private readonly cleanupIntervalId: NodeJS.Timeout;

  constructor(private readonly invoiceQueryService: InvoiceQueryService) {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
    this.progress$.complete();
  }

  async startBackgroundExport(query: ErpInvoiceQuery, userId: string) {
    const queryFingerprint = this.buildQueryFingerprint(query);

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

    const reusableJob = this.findReusableCompletedJob(userId, queryFingerprint);
    if (reusableJob) {
      return {
        jobId: reusableJob.id,
        message:
          'Đã tìm thấy file XLSX đã tạo trước đó. Bạn có thể tải lại ngay.',
        reused: true,
      };
    }

    const timestamp = new Date();
    const dirText = query.direction === 'OUT' ? 'dau_ra' : 'dau_vao';
    const fileName = `Bao_cao_hoa_don_${dirText}_${this.formatDateForFileName(timestamp)}.xlsx`;

    const job: InvoiceExportJob = {
      id: randomUUID(),
      userId,
      status: 'RUNNING',
      current: 0,
      total: InvoiceQueryService.EXPORT_PROGRESS_TOTAL_UNITS,
      message: 'Đang khởi tạo tiến trình xuất Excel...',
      createdAt: Date.now(),
      fileName,
      queryFingerprint,
      dateFrom: query.date_from,
      dateTo: query.date_to,
    };

    this.jobs.set(job.id, job);
    this.activeJobByUser.set(userId, job.id);

    this.emitJobProgress(job, {
      message: 'Đang khởi tạo tiến trình xuất Excel...',
      isRunning: true,
      completed: false,
      ready: false,
      failed: false,
    });

    void this.executeJob(job.id, query);

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
  ): InvoiceExportHistoryResult {
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

  getJobSnapshotForUser(userId: string): InvoiceExportProgressEvent | null {
    const activeJobId = this.activeJobByUser.get(userId);
    if (!activeJobId) return null;

    const job = this.jobs.get(activeJobId);
    if (!job) return null;

    const isRunning = job.status === 'RUNNING';
    const completed = job.status === 'COMPLETED';
    const failed = job.status === 'FAILED';

    return {
      processId: 'invoice-xlsx-export',
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

    return {
      buffer: job.buffer,
      fileName: job.fileName,
    };
  }

  private async executeJob(jobId: string, query: ErpInvoiceQuery) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const buffer = await this.invoiceQueryService.exportExcel(query, {
        onProgress: (current, total, message) => {
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
        },
      });

      const doneJob = this.jobs.get(jobId);
      if (!doneJob) return;

      doneJob.status = 'COMPLETED';
      doneJob.buffer = Buffer.from(buffer);
      doneJob.current = doneJob.total;
      doneJob.message = 'Đã tạo xong file XLSX. Sẵn sàng tải xuống.';
      doneJob.finishedAt = Date.now();
      doneJob.expiresAt =
        Date.now() + InvoiceExportBackgroundService.HISTORY_TTL_MS;

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

      this.logger.error(
        `Invoice export background job failed: ${failedJob.error}`,
      );
    } finally {
      const done = this.jobs.get(jobId);
      if (done) {
        this.activeJobByUser.delete(done.userId);
      }
    }
  }

  private emitJobProgress(
    job: InvoiceExportJob,
    state: {
      isRunning: boolean;
      completed: boolean;
      ready: boolean;
      failed: boolean;
      message: string;
    },
  ) {
    this.progress$.next({
      processId: 'invoice-xlsx-export',
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
    const ttlMs = InvoiceExportBackgroundService.HISTORY_TTL_MS;

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

  private toHistoryItem(job: InvoiceExportJob): InvoiceExportHistoryItem {
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

  private buildQueryFingerprint(query: ErpInvoiceQuery) {
    const normalized = {
      direction: query.direction || '',
      search: (query.search || '').trim(),
      seller_name: (query.seller_name || '').trim(),
      buyer_name: (query.buyer_name || '').trim(),
      partner_tax_code: (query.partner_tax_code || '').trim(),
      date_from: query.date_from || '',
      date_to: query.date_to || '',
      status: (query.status || '').trim(),
      tag_id: (query.tag_id || '').trim(),
      is_valid: (query.is_valid || '').trim(),
      column_search: this.normalizeJsonString(query.column_search),
      column_filters: this.normalizeJsonString(query.column_filters),
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
