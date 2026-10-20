import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  GetInvoiceDebtsQueryDto,
  InvoicePartnerType,
} from '../dto/get-invoice-debts.dto';
import { InvoiceDebtsService } from './invoice-debts.service';

export type InvoiceDebtExportHistoryItem = {
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
  partnerType?: string;
  canDownload: boolean;
};

export type InvoiceDebtExportHistoryResult = {
  items: InvoiceDebtExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type InvoiceDebtExportJob = {
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
  partnerType?: string;
  buffer?: Buffer;
  error?: string;
  expiresAt?: number;
};

@Injectable()
export class InvoiceDebtsExportBackgroundService implements OnModuleDestroy {
  private static readonly HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly TOTAL_UNITS = 100;

  private readonly logger = new Logger(
    InvoiceDebtsExportBackgroundService.name,
  );

  private readonly jobs = new Map<string, InvoiceDebtExportJob>();
  private readonly activeJobByUser = new Map<string, string>();
  private readonly cleanupIntervalId: NodeJS.Timeout;

  constructor(private readonly invoiceDebtsService: InvoiceDebtsService) {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
  }

  async startBackgroundExport(query: GetInvoiceDebtsQueryDto, userId: string) {
    const queryFingerprint = this.buildQueryFingerprint(query);

    const runningJobId = this.activeJobByUser.get(userId);
    if (runningJobId) {
      const runningJob = this.jobs.get(runningJobId);
      if (runningJob && runningJob.status === 'RUNNING') {
        return {
          jobId: runningJob.id,
          message:
            'Đang có một tiến trình xuất Excel công nợ đang chạy. Vui lòng đợi.',
          reused: false,
        };
      }
    }

    const reusableJob = this.findReusableCompletedJob(userId, queryFingerprint);
    if (reusableJob) {
      return {
        jobId: reusableJob.id,
        message:
          'Đã tìm thấy file XLSX công nợ đã tạo trước đó. Bạn có thể tải lại ngay.',
        reused: true,
      };
    }

    const timestamp = new Date();
    const isSupplier = query.partner_type === InvoicePartnerType.SUPPLIER;
    const typeText = isSupplier ? 'nha_cung_cap' : 'khach_hang';
    const fileName = `Bao_cao_cong_no_${typeText}_${this.formatDateForFileName(timestamp)}.xlsx`;

    const job: InvoiceDebtExportJob = {
      id: randomUUID(),
      userId,
      status: 'RUNNING',
      current: 0,
      total: InvoiceDebtsExportBackgroundService.TOTAL_UNITS,
      message: 'Đang khởi tạo tiến trình xuất Excel công nợ...',
      createdAt: Date.now(),
      fileName,
      queryFingerprint,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      partnerType: query.partner_type || InvoicePartnerType.CUSTOMER,
    };

    this.jobs.set(job.id, job);
    this.activeJobByUser.set(userId, job.id);

    void this.executeJob(job.id, query);

    return {
      jobId: job.id,
      message: 'Tiến trình xuất Excel công nợ đang chạy nền.',
      reused: false,
    };
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): InvoiceDebtExportHistoryResult {
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

  getReadyExportFile(jobId: string, userId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Không tìm thấy file xuất Excel công nợ.');
    }

    if (job.status === 'RUNNING') {
      throw new BadRequestException(
        'File Excel công nợ đang được tạo. Vui lòng thử lại sau.',
      );
    }

    if (job.status === 'FAILED') {
      throw new BadRequestException(
        job.error || 'Tiến trình xuất Excel công nợ đã thất bại.',
      );
    }

    if (!job.buffer) {
      throw new NotFoundException(
        'Không tìm thấy dữ liệu file xuất Excel công nợ.',
      );
    }

    return {
      buffer: job.buffer,
      fileName: job.fileName,
    };
  }

  private async executeJob(jobId: string, query: GetInvoiceDebtsQueryDto) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const buffer = await this.invoiceDebtsService.exportDebtsExcel(query, {
        onProgress: (current, total, message) => {
          const activeJob = this.jobs.get(jobId);
          if (!activeJob || activeJob.status !== 'RUNNING') return;

          activeJob.current = current;
          activeJob.total = total;
          activeJob.message = message;
        },
      });

      const doneJob = this.jobs.get(jobId);
      if (!doneJob) return;

      doneJob.status = 'COMPLETED';
      doneJob.buffer = buffer;
      doneJob.current = doneJob.total;
      doneJob.message = 'Đã tạo xong file XLSX. Sẵn sàng tải xuống.';
      doneJob.finishedAt = Date.now();
      doneJob.expiresAt =
        Date.now() + InvoiceDebtsExportBackgroundService.HISTORY_TTL_MS;
    } catch (error: any) {
      const failedJob = this.jobs.get(jobId);
      if (!failedJob) return;

      const failMessage = error?.message || 'Xuất Excel công nợ thất bại';
      failedJob.status = 'FAILED';
      failedJob.error = failMessage;
      failedJob.message = failMessage;
      failedJob.finishedAt = Date.now();

      this.logger.error(
        `Invoice debt export background job failed: ${failedJob.error}`,
      );
    } finally {
      const done = this.jobs.get(jobId);
      if (done) {
        this.activeJobByUser.delete(done.userId);
      }
    }
  }

  private cleanupExpiredJobs() {
    const now = Date.now();
    const ttlMs = InvoiceDebtsExportBackgroundService.HISTORY_TTL_MS;

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
    job: InvoiceDebtExportJob,
  ): InvoiceDebtExportHistoryItem {
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
      partnerType: job.partnerType,
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

  private buildQueryFingerprint(query: GetInvoiceDebtsQueryDto) {
    const normalized = {
      partner_type: query.partner_type || InvoicePartnerType.CUSTOMER,
      search: (query.search || '').trim(),
      date_from: query.date_from || '',
      date_to: query.date_to || '',
      branch_id: (query.branch_id || '').trim(),
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
