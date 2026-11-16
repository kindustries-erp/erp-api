import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Observable, Subject } from 'rxjs';
import {
  formatExportTimestampNoSeconds,
  isExportJobsV2Enabled,
} from '@/v2/core/export-jobs-core';
import { BankStatementsExportJobsService } from '@/v2/modules/export-jobs-bank-statements';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { ErpBankAccount } from '../entities/erp_bank_account.entity';
import { ErpCashBook } from '../entities/erp_cash_book.entity';
import { BankTransactionFilterDto } from '../dto/bank-transaction-filter.dto';
import { TransactionQueryService } from './transaction-query.service';
import {
  BankStatementExcelBuilder,
  NetOffInvoiceItem,
} from './bank-statement-excel.builder';
import type {
  BankStatementExportProgressEvent,
  BankStatementExportHistoryItem,
  BankStatementExportHistoryResult,
  BankStatementExportJob,
} from '../types/bank-statement-export.types';
import { readBranchIds } from '../../common/utils/branch-ids.util';

export type {
  BankStatementExportProgressEvent,
  BankStatementExportHistoryItem,
  BankStatementExportHistoryResult,
  BankStatementExportJob,
};

@Injectable()
export class BankStatementExportBackgroundService implements OnModuleDestroy {
  private static readonly HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly TOTAL_UNITS = 100;

  private readonly logger = new Logger(
    BankStatementExportBackgroundService.name,
  );
  /** Luồng tiến độ của cơ chế cũ (chỉ dùng khi cờ `EXPORT_JOBS_V2` tắt). */
  private readonly legacyProgress$ =
    new Subject<BankStatementExportProgressEvent>();

  private readonly jobs = new Map<string, BankStatementExportJob>();
  private readonly activeJobByUser = new Map<string, string>();
  private readonly cleanupIntervalId: NodeJS.Timeout;

  constructor(
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    @InjectRepository(ErpBankAccount)
    private readonly bankAccountRepo: Repository<ErpBankAccount>,
    @InjectRepository(ErpCashBook)
    private readonly cashBookRepo: Repository<ErpCashBook>,
    private readonly transactionQueryService: TransactionQueryService,
    private readonly excelBuilder: BankStatementExcelBuilder,
    @Optional()
    private readonly v2Jobs?: BankStatementsExportJobsService,
  ) {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 60_000);
  }

  /** Job nền V2 (lõi `export-jobs-core`) khi cờ bật và đã được cấp; ngược lại dùng cơ chế cũ bên dưới. */
  private get v2(): BankStatementsExportJobsService | undefined {
    return this.v2Jobs && isExportJobsV2Enabled() ? this.v2Jobs : undefined;
  }

  get progress$(): Observable<BankStatementExportProgressEvent> {
    return (this.v2?.progress$ ??
      this.legacyProgress$) as Observable<BankStatementExportProgressEvent>;
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
    this.legacyProgress$.complete();
  }

  async startBackgroundExport(query: BankTransactionFilterDto, userId: string) {
    const queryFingerprint = this.buildQueryFingerprint(query);

    if (this.v2) {
      return this.v2.startBackgroundExport({
        userId,
        fingerprint: queryFingerprint,
        fileName: await this.resolveExportFileName(query),
        totalUnits: BankStatementExportBackgroundService.TOTAL_UNITS,
        dateFrom: query.startDate,
        dateTo: query.endDate,
        producer: (onProgress) =>
          this.generateExcelBuffer(query, (current, message) =>
            onProgress(
              current,
              BankStatementExportBackgroundService.TOTAL_UNITS,
              message,
            ),
          ),
      });
    }

    const runningJobId = this.activeJobByUser.get(userId);
    if (runningJobId) {
      const runningJob = this.jobs.get(runningJobId);
      if (runningJob && runningJob.status === 'RUNNING') {
        return {
          jobId: runningJob.id,
          message: 'Đang có một tiến trình xuất Excel đang chạy. Vui lòng đợi.',
          reused: true,
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

    const fileName = await this.resolveExportFileName(query);

    const job: BankStatementExportJob = {
      id: randomUUID(),
      userId,
      status: 'RUNNING',
      current: 0,
      total: BankStatementExportBackgroundService.TOTAL_UNITS,
      message: 'Đang khởi tạo tiến trình xuất Excel...',
      createdAt: Date.now(),
      fileName,
      queryFingerprint,
      dateFrom: query.startDate,
      dateTo: query.endDate,
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

  /** Tên file xuất: tra tên sổ quỹ hoặc số tài khoản, gắn mốc `YYYYMMDD_HHmm`. */
  private async resolveExportFileName(
    query: BankTransactionFilterDto,
  ): Promise<string> {
    const dateStr = formatExportTimestampNoSeconds(new Date());

    if (query.sourceType === 'CASH') {
      if (query.cashBookId) {
        const cashBook = await this.cashBookRepo.findOne({
          where: { id: query.cashBookId },
        });
        const cleanName = cashBook?.name
          ? cashBook.name.replace(/[^a-zA-Z0-9_À-ỹ-]/g, '_')
          : 'So_quy';
        return `So_quy_${cleanName}_${dateStr}.xlsx`;
      }
      return `So_quy_tat_ca_${dateStr}.xlsx`;
    }

    if (query.bankAccountId) {
      const bankAccount = await this.bankAccountRepo.findOne({
        where: { id: query.bankAccountId },
      });
      const cleanAcc = bankAccount?.accountNumber
        ? bankAccount.accountNumber.replace(/[^a-zA-Z0-9_-]/g, '')
        : 'TK';
      return `Sao_ke_${cleanAcc}_${dateStr}.xlsx`;
    }
    return `Sao_ke_tat_ca_tai_khoan_${dateStr}.xlsx`;
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): BankStatementExportHistoryResult {
    if (this.v2) {
      return this.v2.listHistoryForUser(userId, page, pageSize);
    }

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
  ): BankStatementExportProgressEvent | null {
    if (this.v2) {
      return this.v2.getJobSnapshotForUser(
        userId,
      ) as BankStatementExportProgressEvent | null;
    }

    const activeJobId = this.activeJobByUser.get(userId);
    if (!activeJobId) return null;

    const job = this.jobs.get(activeJobId);
    if (!job) return null;

    const isRunning = job.status === 'RUNNING';
    const completed = job.status === 'COMPLETED';
    const failed = job.status === 'FAILED';

    return {
      processId: 'bank-statement-xlsx-export',
      userId: job.userId,
      jobId: job.id,
      current: job.current,
      total: job.total,
      isRunning,
      completed,
      ready: completed && Boolean(job.buffer),
      failed,
      message: failed ? job.error || job.message : job.message,
      fileName: job.fileName,
    };
  }

  getReadyExportFile(jobId: string, userId: string) {
    if (this.v2) {
      return this.v2.getReadyFile(jobId, userId);
    }

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

  private async executeJob(jobId: string, query: BankTransactionFilterDto) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    try {
      const buffer = await this.generateExcelBuffer(
        query,
        (current, message) => {
          const activeJob = this.jobs.get(jobId);
          if (!activeJob || activeJob.status !== 'RUNNING') return;

          activeJob.current = current;
          activeJob.message = message;

          this.emitJobProgress(activeJob, {
            isRunning: true,
            completed: false,
            ready: false,
            failed: false,
            message,
          });
        },
      );

      const doneJob = this.jobs.get(jobId);
      if (!doneJob) return;

      doneJob.status = 'COMPLETED';
      doneJob.buffer = buffer;
      doneJob.current = doneJob.total;
      doneJob.message = 'Đã tạo xong file Excel. Sẵn sàng tải xuống.';
      doneJob.finishedAt = Date.now();
      doneJob.expiresAt =
        Date.now() + BankStatementExportBackgroundService.HISTORY_TTL_MS;

      this.emitJobProgress(doneJob, {
        isRunning: false,
        completed: true,
        ready: true,
        failed: false,
        message: doneJob.message,
      });
    } catch (error: any) {
      this.logger.error(
        `Export excel background failed for job ${jobId}`,
        error,
      );
      const failedJob = this.jobs.get(jobId);
      if (!failedJob) return;

      const failMessage = error?.message || 'Xuất Excel thất bại.';
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

  /** Sinh buffer xlsx. Dùng chung cho cơ chế cũ và job V2 nên nội dung file không đổi. */
  private async generateExcelBuffer(
    query: BankTransactionFilterDto,
    onProgress: (current: number, message: string) => void,
  ): Promise<Buffer> {
    onProgress(10, 'Đang truy vấn dữ liệu giao dịch...');

    const qb = this.transactionQueryService.buildTransactionQueryBuilder(query);

    const transactions = await qb.getMany();
    await this.attachBranchNames(transactions);

    onProgress(
      40,
      `Đã tìm thấy ${transactions.length} giao dịch. Đang tải dữ liệu cấn trừ...`,
    );

    let netOffDetails: NetOffInvoiceItem[] = [];
    if (transactions.length > 0) {
      const ids = transactions.map((i) => i.id);
      netOffDetails = await this.transactionRepo.manager
        .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
        .innerJoin('erp_invoices', 'inv', 'inv.id = netoff.invoice_id')
        .select([
          'netoff.bank_transaction_id as "bankTransactionId"',
          'netoff.net_off_amount as "netOffAmount"',
          'inv.id as "invoiceId"',
          'inv.invoice_no as "invoiceNo"',
          'inv.serial_no as "serialNo"',
          'inv.invoice_date as "invoiceDate"',
          'inv.description as "invoiceDescription"',
          'inv.direction as "direction"',
          'inv.seller_name as "sellerName"',
          'inv.seller_tax_code as "sellerTaxCode"',
          'inv.buyer_name as "buyerName"',
          'inv.buyer_tax_code as "buyerTaxCode"',
          'inv.total_amount as "totalAmount"',
          '(SELECT string_agg(ib.name, \', \' ORDER BY ib.name) FROM erp_branches ib WHERE ib.id = ANY(inv.branch_ids)) as "invoiceBranchName"',
        ])
        .where('netoff.bank_transaction_id IN (:...ids)', { ids })
        .orderBy('inv.invoice_date', 'ASC')
        .getRawMany();
    }

    const selectedColumns = this.parseSelectedColumns(query.selected_columns);

    const buffer = await this.excelBuilder.build({
      sourceType: query.sourceType,
      transactions,
      netOffDetails,
      selectedColumns,
      onProgress,
    });

    onProgress(100, 'Tạo file hoàn tất!');
    return buffer;
  }

  /** Gắn tên mọi chi nhánh của từng dòng (`branchNames`), không chỉ chi nhánh đầu. */
  private async attachBranchNames(
    transactions: { branchIds?: string[] | null; branchId?: string | null }[],
  ): Promise<void> {
    const allIds = [...new Set(transactions.flatMap((t) => readBranchIds(t)))];
    if (allIds.length === 0) return;
    const rows: { id: string; name: string }[] =
      await this.transactionRepo.manager.query(
        'SELECT id, name FROM erp_branches WHERE id = ANY($1::uuid[])',
        [allIds],
      );
    const nameById = new Map(rows.map((r) => [r.id, r.name]));
    for (const t of transactions) {
      (t as { branchNames?: string }).branchNames = readBranchIds(t)
        .map((id) => nameById.get(id))
        .filter((name): name is string => !!name)
        .join(', ');
    }
  }

  private parseSelectedColumns(raw?: string[] | string): string[] | undefined {
    if (!raw) return undefined;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return undefined;
  }

  private emitJobProgress(
    job: BankStatementExportJob,
    state: {
      isRunning: boolean;
      completed: boolean;
      ready: boolean;
      failed: boolean;
      message: string;
    },
  ) {
    this.legacyProgress$.next({
      processId: 'bank-statement-xlsx-export',
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

  private toHistoryItem(
    job: BankStatementExportJob,
  ): BankStatementExportHistoryItem {
    return {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status,
      current: job.current,
      total: job.total,
      message: job.error || job.message,
      createdAt: new Date(job.createdAt).toISOString(),
      finishedAt: job.finishedAt
        ? new Date(job.finishedAt).toISOString()
        : undefined,
      expiresAt: job.expiresAt
        ? new Date(job.expiresAt).toISOString()
        : undefined,
      dateFrom: job.dateFrom,
      dateTo: job.dateTo,
      canDownload: job.status === 'COMPLETED' && Boolean(job.buffer),
    };
  }

  private findReusableCompletedJob(
    userId: string,
    queryFingerprint: string,
  ): BankStatementExportJob | null {
    const now = Date.now();
    for (const job of this.jobs.values()) {
      if (
        job.userId === userId &&
        job.queryFingerprint === queryFingerprint &&
        job.status === 'COMPLETED' &&
        job.buffer &&
        job.expiresAt &&
        job.expiresAt > now
      ) {
        return job;
      }
    }
    return null;
  }

  private cleanupExpiredJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (job.expiresAt && job.expiresAt <= now) {
        this.jobs.delete(id);
      }
    }
  }

  private buildQueryFingerprint(query: BankTransactionFilterDto): string {
    const rawColumnFilters = query.column_filters || query.columnFilters;
    const rawColumnSearch = query.column_search || query.columnSearch;

    const stable = {
      sourceType: query.sourceType || '',
      branchId: query.branchId || '',
      branchIds: [...(query.branchIds || [])].sort(),
      bankAccountId: query.bankAccountId || '',
      cashBookId: query.cashBookId || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      transactionType: query.transactionType || '',
      search: query.search || '',
      tagIds: Array.isArray(query.tagIds)
        ? [...query.tagIds].sort().join(',')
        : '',
      columnFilters:
        typeof rawColumnFilters === 'object'
          ? JSON.stringify(rawColumnFilters)
          : rawColumnFilters || '',
      columnSearch:
        typeof rawColumnSearch === 'object'
          ? JSON.stringify(rawColumnSearch)
          : rawColumnSearch || '',
      selectedColumns: Array.isArray(query.selected_columns)
        ? [...query.selected_columns].sort().join(',')
        : query.selected_columns || '',
      sortBy: query.sortBy || '',
      sortOrder: query.sortOrder || '',
    };
    return JSON.stringify(stable);
  }
}
