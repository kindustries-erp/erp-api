import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Subject } from 'rxjs';
import { Workbook } from 'exceljs';

import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { ErpBankAccount } from '../entities/erp_bank_account.entity';
import { ErpCashBook } from '../entities/erp_cash_book.entity';
import { BankTransactionFilterDto } from '../dto/bank-transaction-filter.dto';

export type BankStatementExportProgressEvent = {
  processId: 'bank-statement-xlsx-export' | 'ping';
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

export type BankStatementExportHistoryItem = {
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

export type BankStatementExportHistoryResult = {
  items: BankStatementExportHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type BankStatementExportJob = {
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
export class BankStatementExportBackgroundService implements OnModuleDestroy {
  private static readonly HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly TOTAL_UNITS = 100;

  private readonly logger = new Logger(
    BankStatementExportBackgroundService.name,
  );
  public readonly progress$ = new Subject<BankStatementExportProgressEvent>();

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
  ) {
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredJobs();
    }, 60_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupIntervalId);
    this.progress$.complete();
  }

  async startBackgroundExport(query: BankTransactionFilterDto, userId: string) {
    const queryFingerprint = this.buildQueryFingerprint(query);

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

    const timestamp = new Date();
    const dateStr = this.formatDateForFileName(timestamp);
    let fileName: string;

    if (query.sourceType === 'CASH') {
      if (query.cashBookId) {
        const cashBook = await this.cashBookRepo.findOne({
          where: { id: query.cashBookId },
        });
        const cleanName = cashBook?.name
          ? cashBook.name.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_')
          : 'So_quy';
        fileName = `So_quy_${cleanName}_${dateStr}.xlsx`;
      } else {
        fileName = `So_quy_tat_ca_${dateStr}.xlsx`;
      }
    } else {
      if (query.bankAccountId) {
        const bankAccount = await this.bankAccountRepo.findOne({
          where: { id: query.bankAccountId },
        });
        const cleanAcc = bankAccount?.accountNumber
          ? bankAccount.accountNumber.replace(/[^a-zA-Z0-9_-]/g, '')
          : 'TK';
        fileName = `Sao_ke_${cleanAcc}_${dateStr}.xlsx`;
      } else {
        fileName = `Sao_ke_tat_ca_tai_khoan_${dateStr}.xlsx`;
      }
    }

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

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): BankStatementExportHistoryResult {
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

  private async generateExcelBuffer(
    query: BankTransactionFilterDto,
    onProgress: (current: number, message: string) => void,
  ): Promise<Buffer> {
    onProgress(10, 'Đang truy vấn dữ liệu giao dịch...');

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.branch', 'branch')
      .leftJoinAndSelect('txn.bankAccount', 'bankAccount')
      .leftJoinAndSelect('txn.cashBook', 'cashBook')
      .leftJoinAndSelect('txn.invoiceNetOffs', 'invoiceNetOffs')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false });

    if (query.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: query.sourceType,
      });
    }
    if (query.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.bankAccountId) {
      qb.andWhere('txn.bankAccountId = :bankAccountId', {
        bankAccountId: query.bankAccountId,
      });
    }
    if (query.cashBookId) {
      qb.andWhere('txn.cashBookId = :cashBookId', {
        cashBookId: query.cashBookId,
      });
    }
    if (query.startDate) {
      qb.andWhere('txn.transDate >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      qb.andWhere('txn.transDate <= :endDate', {
        endDate:
          query.endDate.length === 10
            ? `${query.endDate} 23:59:59`
            : query.endDate,
      });
    }
    if (query.transactionType === 'IN') {
      qb.andWhere('txn.creditAmount > 0');
    } else if (query.transactionType === 'OUT') {
      qb.andWhere('txn.debitAmount > 0');
    }

    if (query.search) {
      qb.andWhere(
        '(txn.description ILIKE :search OR txn.referenceNumber ILIKE :search OR txn.correspondentAccount ILIKE :search OR txn.correspondentName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('txn.transDate', 'DESC').addOrderBy('txn.createdAt', 'DESC');

    const transactions = await qb.getMany();

    onProgress(
      40,
      `Đã tìm thấy ${transactions.length} giao dịch. Đang tải dữ liệu cấn trừ...`,
    );

    // Load net off amounts
    let netOffMap: Record<string, number> = {};
    if (transactions.length > 0) {
      const ids = transactions.map((i) => i.id);
      const netOffs = await this.transactionRepo.manager
        .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
        .select('netoff.bank_transaction_id', 'bankTransactionId')
        .addSelect('SUM(netoff.net_off_amount)', 'sum')
        .where('netoff.bank_transaction_id IN (:...ids)', { ids })
        .groupBy('netoff.bank_transaction_id')
        .getRawMany();

      netOffMap = netOffs.reduce(
        (acc, curr) => {
          acc[curr.bankTransactionId] = Number(curr.sum) || 0;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    onProgress(65, 'Đang tạo bảng tính Excel...');

    const workbook = new Workbook();
    const sheetName =
      query.sourceType === 'CASH' ? 'Sổ quỹ Tiền mặt' : 'Sao kê Ngân hàng';
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 8 },
      {
        header: query.sourceType === 'CASH' ? 'Sổ quỹ' : 'Ngân hàng',
        key: 'account',
        width: 25,
      },
      { header: 'Ngày GD', key: 'transDate', width: 20 },
      { header: 'Số tham chiếu', key: 'referenceNumber', width: 24 },
      { header: 'Diễn giải', key: 'description', width: 45 },
      {
        header: 'Thu (VND)',
        key: 'credit',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Chi (VND)',
        key: 'debit',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Số dư (VND)',
        key: 'balance',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Đã cấn trừ (VND)',
        key: 'netOffAmount',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      {
        header: 'Còn lại (VND)',
        key: 'remainingAmount',
        width: 18,
        style: { numFmt: '#,##0' },
      },
      { header: 'TK đối ứng', key: 'correspondentAccount', width: 18 },
      { header: 'Tên đối tác', key: 'correspondentName', width: 30 },
      { header: 'Ngân hàng đối tác', key: 'correspondentBank', width: 22 },
      { header: 'Chi nhánh', key: 'branchName', width: 22 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    let totalCredit = 0;
    let totalDebit = 0;
    let totalNetOff = 0;
    let totalRemaining = 0;

    transactions.forEach((item, index) => {
      const credit = parseFloat(item.creditAmount as any) || 0;
      const debit = parseFloat(item.debitAmount as any) || 0;
      const netOff = netOffMap[item.id] || 0;
      const remaining = Math.max(0, Math.max(credit, debit) - netOff);

      totalCredit += credit;
      totalDebit += debit;
      totalNetOff += netOff;
      totalRemaining += remaining;

      const accountText =
        query.sourceType === 'CASH'
          ? item.cashBook?.name || ''
          : item.bankAccount
            ? `${item.bankAccount.bankCode} - ${item.bankAccount.accountNumber}`
            : '';

      const transDateStr = item.transDate
        ? new Date(item.transDate).toLocaleString('vi-VN')
        : '-';

      worksheet.addRow({
        stt: index + 1,
        account: accountText,
        transDate: transDateStr,
        referenceNumber: item.referenceNumber || '',
        description: item.description || '',
        credit,
        debit,
        balance: parseFloat(item.balance as any) || 0,
        netOffAmount: netOff,
        remainingAmount: remaining,
        correspondentAccount: item.correspondentAccount || '',
        correspondentName: item.correspondentName || '',
        correspondentBank: item.correspondentBank || '',
        branchName: item.branch?.name || '',
      });
    });

    onProgress(85, 'Đang tổng hợp dữ liệu và hoàn tất file...');

    // Summary row
    const summaryRow = worksheet.addRow({
      stt: 'TỔNG CỘNG',
      account: '',
      transDate: '',
      referenceNumber: '',
      description: `Tổng số: ${transactions.length} giao dịch`,
      credit: totalCredit,
      debit: totalDebit,
      balance: '',
      netOffAmount: totalNetOff,
      remainingAmount: totalRemaining,
      correspondentAccount: '',
      correspondentName: '',
      correspondentBank: '',
      branchName: '',
    });

    summaryRow.height = 24;
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    onProgress(100, 'Tạo file hoàn tất!');
    return Buffer.from(buffer);
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
    this.progress$.next({
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
    const stable = {
      sourceType: query.sourceType || '',
      branchId: query.branchId || '',
      bankAccountId: query.bankAccountId || '',
      cashBookId: query.cashBookId || '',
      startDate: query.startDate || '',
      endDate: query.endDate || '',
      transactionType: query.transactionType || '',
      search: query.search || '',
      columnFilters: query.column_filters || '',
      columnSearch: query.column_search || '',
    };
    return JSON.stringify(stable);
  }

  private formatDateForFileName(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}`;
  }
}
