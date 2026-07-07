import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, Brackets } from 'typeorm';
import * as crypto from 'crypto';
import { ErpBankAccount } from './entities/erp_bank_account.entity';
import { ErpCashBook } from './entities/erp_cash_book.entity';
import { ErpBankTransaction } from './entities/erp_bank_transaction.entity';
import { ErpBankAccountBalance } from './entities/erp_bank_account_balance.entity';
import { ErpCashBookBalance } from './entities/erp_cash_book_balance.entity';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/create-bank-account.dto';
import {
  CreateCashBookDto,
  UpdateCashBookDto,
} from './dto/create-cash-book.dto';
import { BankTransactionFilterDto } from './dto/bank-transaction-filter.dto';
import { parseTcbCsv, parseTcbXlsx } from './parsers/tcb.parser';
import { parseBidvXlsx } from './parsers/bidv.parser';
import { parseCashXlsx } from './parsers/cash.parser';
import {
  CreateBankAccountBalanceDto,
  UpdateBankAccountBalanceDto,
} from './dto/create-bank-account-balance.dto';
import {
  CreateCashBookBalanceDto,
  UpdateCashBookBalanceDto,
} from './dto/create-cash-book-balance.dto';
import { CreateBankTransactionDto } from './dto/create-bank-transaction.dto';
import { AccountingCoreService } from '../accounting-core/services/accounting-core.service';

@Injectable()
export class BankTransactionsCoreService {
  constructor(
    @InjectRepository(ErpBankAccount)
    private readonly bankAccountRepo: Repository<ErpBankAccount>,
    @InjectRepository(ErpCashBook)
    private readonly cashBookRepo: Repository<ErpCashBook>,
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    @InjectRepository(ErpBankAccountBalance)
    private readonly bankAccountBalanceRepo: Repository<ErpBankAccountBalance>,
    @InjectRepository(ErpCashBookBalance)
    private readonly cashBookBalanceRepo: Repository<ErpCashBookBalance>,
    private readonly dataSource: DataSource,
    private readonly accountingCoreService: AccountingCoreService,
  ) {}

  // --- Bank Accounts ---
  async getBankAccounts(
    branchId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (endDate && endDate.length === 10) endDate = `${endDate} 23:59:59.999`;
    const where: any = { isDeleted: false };
    if (branchId) where.branchId = branchId;

    const accounts = await this.bankAccountRepo.find({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });

    const accountsWithBalance = await Promise.all(
      accounts.map(async (acc) => {
        let baseBalance = 0;
        let baseDate: string | null = null;

        const balanceQb = this.bankAccountBalanceRepo
          .createQueryBuilder('bal')
          .where('bal.bankAccountId = :id', { id: acc.id })
          .andWhere('bal.isDeleted = false')
          .orderBy('bal.periodDate', 'DESC');

        if (startDate) {
          balanceQb.andWhere('bal.periodDate <= :startDate', { startDate });
        } else {
          balanceQb.orderBy('bal.periodDate', 'ASC');
        }

        const balance = await balanceQb.getOne();
        if (balance) {
          baseBalance = Number(balance.openingBalance);
          baseDate = new Date(balance.periodDate).toISOString();
        }

        let openingBalanceAtStart = baseBalance;
        if (startDate && baseDate) {
          const qbBefore = this.transactionRepo
            .createQueryBuilder('txn')
            .select('SUM(txn.creditAmount)', 'credit')
            .addSelect('SUM(txn.debitAmount)', 'debit')
            .where('txn.bankAccountId = :id', { id: acc.id })
            .andWhere('txn.isDeleted = false')
            .andWhere('txn.transDate >= :baseDate', { baseDate })
            .andWhere('txn.transDate < :startDate', { startDate });
          const beforeStats = await qbBefore.getRawOne();
          openingBalanceAtStart +=
            Number(beforeStats?.credit || 0) - Number(beforeStats?.debit || 0);
        } else if (startDate && !baseDate) {
          const qbBefore = this.transactionRepo
            .createQueryBuilder('txn')
            .select('SUM(txn.creditAmount)', 'credit')
            .addSelect('SUM(txn.debitAmount)', 'debit')
            .where('txn.bankAccountId = :id', { id: acc.id })
            .andWhere('txn.isDeleted = false')
            .andWhere('txn.transDate < :startDate', { startDate });
          const beforeStats = await qbBefore.getRawOne();
          openingBalanceAtStart +=
            Number(beforeStats?.credit || 0) - Number(beforeStats?.debit || 0);
        }

        const qbDuring = this.transactionRepo
          .createQueryBuilder('txn')
          .select('SUM(txn.creditAmount)', 'credit')
          .addSelect('SUM(txn.debitAmount)', 'debit')
          .where('txn.bankAccountId = :id', { id: acc.id })
          .andWhere('txn.isDeleted = false');

        if (startDate) {
          qbDuring.andWhere('txn.transDate >= :startDate', { startDate });
        } else if (baseDate) {
          qbDuring.andWhere('txn.transDate >= :baseDate', { baseDate });
        }
        if (endDate) {
          qbDuring.andWhere('txn.transDate <= :endDate', { endDate });
        }

        const duringStats = await qbDuring.getRawOne();
        const totalCredit = Number(duringStats?.credit || 0);
        const totalDebit = Number(duringStats?.debit || 0);

        const currentBalance = openingBalanceAtStart + totalCredit - totalDebit;

        return {
          ...acc,
          openingBalance: openingBalanceAtStart,
          totalCredit,
          totalDebit,
          netChange: totalCredit - totalDebit,
          currentBalance,
          periodDate:
            balance && balance.periodDate
              ? new Date(balance.periodDate).toISOString().split('T')[0]
              : null,
        };
      }),
    );
    return accountsWithBalance;
  }

  async createBankAccount(dto: CreateBankAccountDto) {
    const { openingBalance, periodDate, ...accountDto } = dto;
    const account = this.bankAccountRepo.create(accountDto);
    const saved = await this.bankAccountRepo.save(account);

    if (periodDate) {
      const balance = this.bankAccountBalanceRepo.create({
        bankAccountId: saved.id,
        periodDate: new Date(periodDate),
        openingBalance: openingBalance || 0,
      });
      await this.bankAccountBalanceRepo.save(balance);
    }
    return saved;
  }

  async updateBankAccount(id: string, dto: UpdateBankAccountDto) {
    const { openingBalance, periodDate, ...accountDto } = dto;
    const account = await this.bankAccountRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    Object.assign(account, accountDto);
    const updated = await this.bankAccountRepo.save(account);

    if (periodDate) {
      let balance = await this.bankAccountBalanceRepo.findOne({
        where: {
          bankAccountId: id,
          periodDate: new Date(periodDate),
          isDeleted: false,
        },
      });
      if (!balance) {
        balance = this.bankAccountBalanceRepo.create({
          bankAccountId: id,
          periodDate: new Date(periodDate),
          openingBalance: openingBalance || 0,
        });
      } else {
        balance.openingBalance = openingBalance || 0;
      }
      await this.bankAccountBalanceRepo.save(balance);
    }

    return updated;
  }

  async deleteBankAccount(id: string) {
    const account = await this.bankAccountRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!account) throw new NotFoundException('Bank account not found');
    account.isDeleted = true;
    return this.bankAccountRepo.save(account);
  }

  // --- Cash Books ---
  async getCashBooks(branchId?: string, startDate?: string, endDate?: string) {
    if (endDate && endDate.length === 10) endDate = `${endDate} 23:59:59.999`;
    const where: any = { isDeleted: false };
    if (branchId) where.branchId = branchId;

    const books = await this.cashBookRepo.find({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });

    const booksWithBalance = await Promise.all(
      books.map(async (book) => {
        let baseBalance = 0;
        let baseDate: string | null = null;

        const balanceQb = this.cashBookBalanceRepo
          .createQueryBuilder('bal')
          .where('bal.cashBookId = :id', { id: book.id })
          .andWhere('bal.isDeleted = false')
          .orderBy('bal.periodDate', 'DESC');

        if (startDate) {
          balanceQb.andWhere('bal.periodDate <= :startDate', { startDate });
        } else {
          balanceQb.orderBy('bal.periodDate', 'ASC');
        }

        const balance = await balanceQb.getOne();
        if (balance) {
          baseBalance = Number(balance.openingBalance);
          baseDate = new Date(balance.periodDate).toISOString();
        }

        let openingBalanceAtStart = baseBalance;
        if (startDate && baseDate) {
          const qbBefore = this.transactionRepo
            .createQueryBuilder('txn')
            .select('SUM(txn.creditAmount)', 'credit')
            .addSelect('SUM(txn.debitAmount)', 'debit')
            .where('txn.cashBookId = :id', { id: book.id })
            .andWhere('txn.isDeleted = false')
            .andWhere('txn.transDate >= :baseDate', { baseDate })
            .andWhere('txn.transDate < :startDate', { startDate });
          const beforeStats = await qbBefore.getRawOne();
          openingBalanceAtStart +=
            Number(beforeStats?.credit || 0) - Number(beforeStats?.debit || 0);
        } else if (startDate && !baseDate) {
          const qbBefore = this.transactionRepo
            .createQueryBuilder('txn')
            .select('SUM(txn.creditAmount)', 'credit')
            .addSelect('SUM(txn.debitAmount)', 'debit')
            .where('txn.cashBookId = :id', { id: book.id })
            .andWhere('txn.isDeleted = false')
            .andWhere('txn.transDate < :startDate', { startDate });
          const beforeStats = await qbBefore.getRawOne();
          openingBalanceAtStart +=
            Number(beforeStats?.credit || 0) - Number(beforeStats?.debit || 0);
        }

        const qbDuring = this.transactionRepo
          .createQueryBuilder('txn')
          .select('SUM(txn.creditAmount)', 'credit')
          .addSelect('SUM(txn.debitAmount)', 'debit')
          .where('txn.cashBookId = :id', { id: book.id })
          .andWhere('txn.isDeleted = false');

        if (startDate) {
          qbDuring.andWhere('txn.transDate >= :startDate', { startDate });
        } else if (baseDate) {
          qbDuring.andWhere('txn.transDate >= :baseDate', { baseDate });
        }
        if (endDate) {
          qbDuring.andWhere('txn.transDate <= :endDate', { endDate });
        }

        const duringStats = await qbDuring.getRawOne();
        const totalCredit = Number(duringStats?.credit || 0);
        const totalDebit = Number(duringStats?.debit || 0);

        const currentBalance = openingBalanceAtStart + totalCredit - totalDebit;

        return {
          ...book,
          openingBalance: openingBalanceAtStart,
          totalCredit,
          totalDebit,
          netChange: totalCredit - totalDebit,
          currentBalance,
          periodDate:
            balance && balance.periodDate
              ? new Date(balance.periodDate).toISOString().split('T')[0]
              : null,
        };
      }),
    );
    return booksWithBalance;
  }

  async createCashBook(dto: CreateCashBookDto) {
    const { openingBalance, periodDate, ...bookDto } = dto;
    const book = this.cashBookRepo.create(bookDto);
    const saved = await this.cashBookRepo.save(book);

    if (periodDate) {
      const balance = this.cashBookBalanceRepo.create({
        cashBookId: saved.id,
        periodDate: new Date(periodDate),
        openingBalance: openingBalance || 0,
      });
      await this.cashBookBalanceRepo.save(balance);
    }
    return saved;
  }

  async updateCashBook(id: string, dto: UpdateCashBookDto) {
    const { openingBalance, periodDate, ...bookDto } = dto;
    const book = await this.cashBookRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!book) throw new NotFoundException('Cash book not found');
    Object.assign(book, bookDto);
    const updated = await this.cashBookRepo.save(book);

    if (periodDate) {
      let balance = await this.cashBookBalanceRepo.findOne({
        where: {
          cashBookId: id,
          periodDate: new Date(periodDate),
          isDeleted: false,
        },
      });
      if (!balance) {
        balance = this.cashBookBalanceRepo.create({
          cashBookId: id,
          periodDate: new Date(periodDate),
          openingBalance: openingBalance || 0,
        });
      } else {
        balance.openingBalance = openingBalance || 0;
      }
      await this.cashBookBalanceRepo.save(balance);
    }

    return updated;
  }

  async deleteCashBook(id: string) {
    const book = await this.cashBookRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!book) throw new NotFoundException('Cash book not found');
    book.isDeleted = true;
    return this.cashBookRepo.save(book);
  }

  // --- Transactions ---
  async getTransaction(id: string) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
      relations: [
        'branch',
        'bankAccount',
        'cashBook',
        'invoiceNetOffs',
        'invoiceNetOffs.invoice',
      ],
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    const [mappedTxn] = await this.loadNetOffAmounts([txn]);
    return mappedTxn;
  }
  private async loadNetOffAmounts(transactions: ErpBankTransaction[]) {
    if (transactions.length === 0) return transactions;
    const ids = transactions.map((i) => i.id);
    const netOffs = await this.transactionRepo.manager
      .createQueryBuilder('erp_invoice_voucher_netoff', 'netoff')
      .select('netoff.bank_transaction_id', 'bankTransactionId')
      .addSelect('SUM(netoff.net_off_amount)', 'sum')
      .where('netoff.bank_transaction_id IN (:...ids)', { ids })
      .groupBy('netoff.bank_transaction_id')
      .getRawMany();

    const netOffMap = netOffs.reduce(
      (acc, curr) => {
        acc[curr.bankTransactionId] = Number(curr.sum) || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    return transactions.map((i) => ({
      ...i,
      netOffAmount: String(netOffMap[i.id] || 0),
    }));
  }

  async getTransactions(filter: BankTransactionFilterDto) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.branch', 'branch')
      .leftJoinAndSelect('txn.bankAccount', 'bankAccount')
      .leftJoinAndSelect('txn.cashBook', 'cashBook')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false });

    if (filter.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.bankAccountId) {
      qb.andWhere('txn.bankAccountId = :bankAccountId', {
        bankAccountId: filter.bankAccountId,
      });
    }
    if (filter.cashBookId) {
      qb.andWhere('txn.cashBookId = :cashBookId', {
        cashBookId: filter.cashBookId,
      });
    }
    if (filter.startDate) {
      qb.andWhere('txn.transDate >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      const eDate =
        filter.endDate.length === 10
          ? `${filter.endDate} 23:59:59.999`
          : filter.endDate;
      qb.andWhere('txn.transDate <= :endDate', { endDate: eDate });
    }
    if (filter.search) {
      qb.andWhere(
        '(txn.description ILIKE :search OR txn.referenceNumber ILIKE :search OR txn.correspondentName ILIKE :search OR txn.correspondentAccount ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }
    if (filter.transactionType === 'IN') {
      qb.andWhere('txn.creditAmount > 0');
    } else if (filter.transactionType === 'OUT') {
      qb.andWhere('txn.debitAmount > 0');
    }

    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    if (filter.sortBy) {
      const validSorts = ['transDate', 'debitAmount', 'creditAmount', 'amount'];
      if (validSorts.includes(filter.sortBy)) {
        const order =
          filter.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        if (filter.sortBy === 'amount') {
          qb.addSelect(
            '(COALESCE(txn.creditAmount, 0) - COALESCE(txn.debitAmount, 0))',
            'calc_amount',
          );
          qb.orderBy('calc_amount', order);
        } else {
          qb.orderBy(`txn.${filter.sortBy}`, order);
        }
        qb.addOrderBy('txn.createdAt', 'DESC');
      } else {
        qb.orderBy('txn.transDate', 'DESC').addOrderBy('txn.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('txn.transDate', 'DESC').addOrderBy('txn.createdAt', 'DESC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    const mappedItems = await this.loadNetOffAmounts(items);

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDashboardStats(filter: BankTransactionFilterDto) {
    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .leftJoinAndSelect('txn.bankAccount', 'bankAccount')
      .leftJoinAndSelect('txn.cashBook', 'cashBook')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false });

    if (filter.startDate) {
      qb.andWhere('txn.transDate >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      const eDate =
        filter.endDate.length === 10
          ? `${filter.endDate} 23:59:59.999`
          : filter.endDate;
      qb.andWhere('txn.transDate <= :endDate', { endDate: eDate });
    }
    if (filter.sourceType) {
      qb.andWhere('txn.sourceType = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      qb.andWhere('txn.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    const allTxns = await qb.getMany();

    let totalCashIn = 0;
    let totalCashOut = 0;
    const trendMap = new Map<string, { cashIn: number; cashOut: number }>();
    const sourceMap = new Map<
      string,
      {
        cashIn: number;
        cashOut: number;
        trendMap: Map<string, { cashIn: number; cashOut: number }>;
      }
    >();

    for (const t of allTxns) {
      const inAmt = Number(t.creditAmount || 0);
      const outAmt = Number(t.debitAmount || 0);
      totalCashIn += inAmt;
      totalCashOut += outAmt;

      // Group by month for trend
      const dateStr = t.transDate
        ? new Date(t.transDate).toISOString().substring(0, 7)
        : 'Unknown'; // YYYY-MM
      if (!trendMap.has(dateStr)) {
        trendMap.set(dateStr, { cashIn: 0, cashOut: 0 });
      }
      const trend = trendMap.get(dateStr)!;
      trend.cashIn += inAmt;
      trend.cashOut += outAmt;

      // Group by source for source breakdown
      let sourceLabel = 'Unknown';
      if (t.sourceType === 'BANK' && t.bankAccount) {
        sourceLabel = t.bankAccount.bankName
          ? `${t.bankAccount.bankName} - ${t.bankAccount.accountNumber}`
          : t.bankAccount.accountNumber || 'Bank';
      } else if (t.sourceType === 'CASH' && t.cashBook) {
        sourceLabel = t.cashBook.name || 'Cash Fund';
      }

      if (!sourceMap.has(sourceLabel)) {
        sourceMap.set(sourceLabel, {
          cashIn: 0,
          cashOut: 0,
          trendMap: new Map(),
        });
      }
      const sourceData = sourceMap.get(sourceLabel)!;
      sourceData.cashIn += inAmt;
      sourceData.cashOut += outAmt;

      if (!sourceData.trendMap.has(dateStr)) {
        sourceData.trendMap.set(dateStr, { cashIn: 0, cashOut: 0 });
      }
      const sTrend = sourceData.trendMap.get(dateStr)!;
      sTrend.cashIn += inAmt;
      sTrend.cashOut += outAmt;
    }

    const sourceBreakdown = Array.from(sourceMap.entries()).map(
      ([label, data]) => ({
        label,
        cashIn: data.cashIn,
        cashOut: data.cashOut,
        trend: Array.from(data.trendMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0])) // Descending
          .slice(0, 6)
          .sort((a, b) => a[0].localeCompare(b[0])) // Ascending
          .map(([tLabel, tData]) => ({ label: tLabel, ...tData })),
      }),
    );

    const topTransactionsIn = [...allTxns]
      .filter((t) => Number(t.creditAmount) > 0)
      .sort((a, b) => Number(b.creditAmount) - Number(a.creditAmount))
      .slice(0, 10);

    const topTransactionsOut = [...allTxns]
      .filter((t) => Number(t.debitAmount) > 0)
      .sort((a, b) => Number(b.debitAmount) - Number(a.debitAmount))
      .slice(0, 10);

    // Sort trend by month and take latest 6
    const cashTrend = Array.from(trendMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // Descending
      .slice(0, 6)
      .sort((a, b) => a[0].localeCompare(b[0])) // Ascending
      .map(([label, data]) => ({ label, ...data }));

    const categoryBreakdownQb = this.transactionRepo.manager
      .createQueryBuilder()
      .select('tag.id', 'tagId')
      .addSelect('tag.name', 'label')
      .addSelect('tag.color', 'color')
      .addSelect(
        'SUM(COALESCE(txn.debit_amount, 0) + COALESCE(txn.credit_amount, 0))',
        'amount',
      )
      .from('erp_bank_transactions', 'txn')
      .innerJoin(
        'sys_entity_tags',
        'etFilter',
        "etFilter.entity_id = txn.id AND etFilter.entity_type = 'bank_transaction'",
      )
      .innerJoin('sys_tags', 'tag', 'tag.id = etFilter.tag_id')
      .where('txn.is_deleted = :isDeleted', { isDeleted: false });

    if (filter.startDate) {
      categoryBreakdownQb.andWhere('txn.trans_date >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      const eDate =
        filter.endDate.length === 10
          ? `${filter.endDate} 23:59:59.999`
          : filter.endDate;
      categoryBreakdownQb.andWhere('txn.trans_date <= :endDate', {
        endDate: eDate,
      });
    }
    if (filter.sourceType) {
      categoryBreakdownQb.andWhere('txn.source_type = :sourceType', {
        sourceType: filter.sourceType,
      });
    }
    if (filter.branchId) {
      categoryBreakdownQb.andWhere('txn.branch_id = :branchId', {
        branchId: filter.branchId,
      });
    }
    if (filter.tagIds && filter.tagIds.length > 0) {
      categoryBreakdownQb
        .innerJoin(
          'sys_entity_tags',
          'etFilter2',
          `etFilter2.entity_id = txn.id AND etFilter2.entity_type = 'bank_transaction'`,
        )
        .andWhere('etFilter2.tag_id IN (:...tagIds)', {
          tagIds: filter.tagIds,
        });
    }

    const rawCategories = await categoryBreakdownQb
      .groupBy('tag.id')
      .addGroupBy('tag.name')
      .addGroupBy('tag.color')
      .getRawMany();

    const categoryBreakdown = rawCategories.map((r) => ({
      tagId: r.tagId,
      label: r.label,
      color: r.color,
      amount: Number(r.amount || 0),
    }));

    return {
      totalCashIn,
      totalCashOut,
      netCashFlow: totalCashIn - totalCashOut,
      cashTrend,
      categoryBreakdown,
      sourceBreakdown,
      topTransactionsIn,
      topTransactionsOut,
    };
  }

  async createManualTransaction(dto: CreateBankTransactionDto) {
    if (!dto.bankAccountId && !dto.cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }
    const txn = this.transactionRepo.create(dto);
    return this.transactionRepo.save(txn);
  }

  async updateTransaction(
    id: string,
    dto: import('./dto/update-bank-transaction.dto').UpdateBankTransactionDto,
  ) {
    const txn = await this.transactionRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['bankAccount', 'cashBook'],
    });
    if (!txn) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    Object.assign(txn, dto);
    const saved = await this.transactionRepo.save(txn);

    // Refresh journal entries (handles split by subject if net-offs exist)
    await this.refreshJournalEntriesForBankTransaction(saved.id);

    return saved;
  }

  /**
   * Re-generates journal entries for a bank transaction.
   * Handles split entries when multiple invoices with different subjects
   * are linked to the same bank transaction.
   */
  async refreshJournalEntriesForBankTransaction(txnId: string): Promise<void> {
    const txn = await this.transactionRepo.findOne({
      where: { id: txnId, isDeleted: false },
      relations: ['bankAccount', 'cashBook'],
    });
    if (!txn || !txn.correspondentAccountingAccountId) return;

    // Load 331 and 131 account IDs (active, any branch)
    const [apAccountRes, arAccountRes] = await Promise.all([
      this.dataSource.query(
        `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
        ['331'],
      ),
      this.dataSource.query(
        `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
        ['131'],
      ),
    ]);
    const apAccountId = apAccountRes.length > 0 ? apAccountRes[0].id : null;
    const arAccountId = arAccountRes.length > 0 ? arAccountRes[0].id : null;

    // Find bank/cash accounting account
    let defaultAccountId: string | null = null;
    if (txn.sourceType === 'BANK') {
      defaultAccountId = txn.bankAccount?.accountingAccountId || null;
      if (!defaultAccountId) {
        const res = await this.dataSource.query(
          `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
          ['1121'],
        );
        if (res && res.length > 0) defaultAccountId = res[0].id;
      }
    } else if (txn.sourceType === 'CASH') {
      defaultAccountId = txn.cashBook?.accountingAccountId || null;
      if (!defaultAccountId) {
        const res = await this.dataSource.query(
          `SELECT id FROM erp_chart_of_accounts WHERE account_code = $1 AND is_deleted = false LIMIT 1`,
          ['1111'],
        );
        if (res && res.length > 0) defaultAccountId = res[0].id;
      }
    }
    if (!defaultAccountId) return;

    // Load net-offs with invoice info
    const netOffRows: any[] = await this.dataSource.query(
      `SELECT n.id, n.net_off_amount, i.direction, i.seller_name, i.buyer_name, i.invoice_no, i.branch_id, i.description as invoice_desc
       FROM erp_invoice_voucher_netoff n
       JOIN erp_invoices i ON i.id = n.invoice_id AND i.is_deleted = false
       WHERE n.bank_transaction_id = $1
       ORDER BY n.created_at ASC`,
      [txnId],
    );

    const totalAmount =
      Number(txn.creditAmount) > 0
        ? Number(txn.creditAmount)
        : Number(txn.debitAmount);
    const isReceipt = Number(txn.creditAmount) > 0;
    const baseDescription = txn.accountingDescription || txn.description || '';

    // Build groups: [{subject, amount, counterpartAccountId, branchId, description}]
    type Group = {
      subject: string | null;
      amount: number;
      counterpartAccountId: string;
      branchId: string;
      description: string;
    };
    const groups: Group[] = [];

    if (netOffRows.length === 0) {
      // No net-offs: single entry with correspondentName as subject and original counterpart account
      groups.push({
        subject: txn.correspondentName || null,
        amount: totalAmount,
        counterpartAccountId: txn.correspondentAccountingAccountId,
        branchId: txn.branchId,
        description: baseDescription,
      });
    } else {
      // Group by subject and counterpart account
      const groupMap = new Map<string, Group>();

      for (const row of netOffRows) {
        const subject: string | null =
          row.direction === 'IN'
            ? row.seller_name || null
            : row.buyer_name || null;

        let counterpartAccountId = txn.correspondentAccountingAccountId;
        if (row.direction === 'IN' && apAccountId)
          counterpartAccountId = apAccountId;
        if (row.direction === 'OUT' && arAccountId)
          counterpartAccountId = arAccountId;

        const branchId = row.branch_id || txn.branchId;

        const key = `${subject || ''}_${counterpartAccountId}_${branchId}`;
        if (!groupMap.has(key)) {
          const desc = row.invoice_desc
            ? `${baseDescription} - ${row.invoice_desc}`
            : baseDescription;
          groupMap.set(key, {
            subject: subject || null,
            amount: 0,
            counterpartAccountId,
            branchId,
            description: desc,
          });
        }
        groupMap.get(key)!.amount += Number(row.net_off_amount);
      }

      const netOffTotal = netOffRows.reduce(
        (sum: number, r: any) => sum + Number(r.net_off_amount),
        0,
      );

      for (const group of groupMap.values()) {
        groups.push(group);
      }

      // Remaining amount → use correspondentName and original counterpart account
      const remaining = Math.round((totalAmount - netOffTotal) * 100) / 100;
      if (remaining > 0.01) {
        groups.push({
          subject: txn.correspondentName || null,
          amount: remaining,
          counterpartAccountId: txn.correspondentAccountingAccountId,
          branchId: txn.branchId,
          description: baseDescription,
        });
      }
    }

    // Delete existing journal entries for this transaction
    await this.accountingCoreService.deleteJournalEntryBySource(
      txn.id,
      txn.sourceType,
    );

    // Generate base entry number (only once)
    const baseEntryNo = await this.accountingCoreService.generateEntryNo(
      txn.sourceType === 'BANK' ? 'BANK' : 'CASH',
      txn.transDate,
      txn.branchId,
      isReceipt,
    );

    // Create one journal entry per group
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      // Single group → no suffix; multiple groups → a, b, c...
      const entryNo =
        groups.length === 1
          ? baseEntryNo
          : `${baseEntryNo}${String.fromCharCode(97 + i)}`;

      const debitAccount = isReceipt
        ? defaultAccountId
        : group.counterpartAccountId;
      const creditAccount = isReceipt
        ? group.counterpartAccountId
        : defaultAccountId;

      await this.accountingCoreService.createJournalEntry({
        entryNo,
        branchId: group.branchId,
        date: txn.transDate,
        description: group.description,
        subjectName: group.subject || undefined,
        sourceType: txn.sourceType,
        sourceId: txn.id,
        reference: txn.referenceNumber,
        isReceipt,
        lines: [
          {
            accountId: debitAccount,
            debit: group.amount,
            credit: 0,
            description: group.description,
          },
          {
            accountId: creditAccount,
            debit: 0,
            credit: group.amount,
            description: group.description,
          },
        ],
      });
    }
  }

  async importFiles(
    files: Express.Multer.File[],
    branchId: string,
    bankAccountId?: string,
    cashBookId?: string,
  ) {
    if (!bankAccountId && !cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }

    let bankCode: string | undefined;
    if (bankAccountId) {
      const bankAccount = await this.bankAccountRepo.findOne({
        where: { id: bankAccountId },
      });
      if (bankAccount) {
        bankCode = bankAccount.bankCode?.toUpperCase();
      }
    }

    let allDtos: CreateBankTransactionDto[] = [];

    for (const file of files) {
      const ext = file.originalname.split('.').pop()?.toLowerCase();
      let dtos: CreateBankTransactionDto[] = [];

      if (ext === 'csv') {
        dtos = parseTcbCsv(file.buffer, branchId, bankAccountId, cashBookId);
      } else if (ext === 'xlsx') {
        if (cashBookId) {
          dtos = await parseCashXlsx(
            file.buffer,
            branchId,
            bankAccountId,
            cashBookId,
          );
        } else {
          // Check bankCode first, fallback to filename if missing
          const isTcb =
            bankCode === 'TCB' ||
            (!bankCode && file.originalname.toLowerCase().includes('tcb'));

          if (isTcb) {
            dtos = await parseTcbXlsx(
              file.buffer,
              branchId,
              bankAccountId,
              cashBookId,
            );
          } else {
            dtos = await parseBidvXlsx(
              file.buffer,
              branchId,
              bankAccountId,
              cashBookId,
            );
          }
        }
      } else {
        throw new BadRequestException(
          `Unsupported file format: ${file.originalname}. Please upload .csv or .xlsx`,
        );
      }

      allDtos = [...allDtos, ...dtos];
    }

    if (allDtos.length === 0) {
      throw new BadRequestException(
        'No valid transactions found in the uploaded files',
      );
    }

    // Deduplication logic
    const startDate = new Date(
      Math.min(...allDtos.map((d) => new Date(d.transDate).getTime())),
    );
    const endDate = new Date(
      Math.max(...allDtos.map((d) => new Date(d.transDate).getTime())),
    );

    // Expand search window to handle timezone offsets
    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);

    const referenceNumbers = allDtos
      .map((d) => d.referenceNumber)
      .filter(Boolean);

    const existingQb = this.transactionRepo
      .createQueryBuilder('txn')
      .where('txn.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        new Brackets((qb) => {
          qb.where(
            'txn.transDate >= :startDate AND txn.transDate <= :endDate',
            { startDate, endDate },
          );
          if (referenceNumbers.length > 0) {
            qb.orWhere('txn.referenceNumber IN (:...referenceNumbers)', {
              referenceNumbers,
            });
          }
        }),
      );

    if (bankAccountId) {
      existingQb.andWhere('txn.bankAccountId = :bankAccountId', {
        bankAccountId,
      });
    }
    if (cashBookId) {
      existingQb.andWhere('txn.cashBookId = :cashBookId', { cashBookId });
    }

    const existingTxns = await existingQb.getMany();

    const existingKeys = new Set(
      existingTxns.map((t) => {
        if (t.referenceNumber) return `REF_${t.referenceNumber}`;
        return `${new Date(t.transDate).toISOString()}_${Number(t.debitAmount || 0)}_${Number(t.creditAmount || 0)}_${(t.description || '').trim()}`;
      }),
    );

    const newDtos = allDtos.filter((d) => {
      const key = d.referenceNumber
        ? `REF_${d.referenceNumber}`
        : `${new Date(d.transDate).toISOString()}_${Number(d.debitAmount || 0)}_${Number(d.creditAmount || 0)}_${(d.description || '').trim()}`;
      return !existingKeys.has(key);
    });

    if (newDtos.length === 0) {
      throw new BadRequestException(
        'Tất cả giao dịch trong file này đã tồn tại trong hệ thống',
      );
    }

    const importBatchId = crypto.randomUUID();
    const entities = newDtos.map((dto) =>
      this.transactionRepo.create({ ...dto, importBatchId }),
    );

    await this.transactionRepo.save(entities, { chunk: 100 });

    return {
      success: true,
      count: entities.length,
      importBatchId,
    };
  }

  async rollbackBatch(importBatchId: string) {
    const txns = await this.transactionRepo.find({
      where: { importBatchId, isDeleted: false },
    });
    if (txns.length === 0) {
      throw new NotFoundException('Batch not found or already rolled back');
    }

    await this.transactionRepo.update({ importBatchId }, { isDeleted: true });
    return { success: true, rolledBackCount: txns.length };
  }

  // --- Bank Account Balances ---
  async getBankAccountBalances(bankAccountId: string) {
    return this.bankAccountBalanceRepo.find({
      where: { bankAccountId, isDeleted: false },
      order: { periodDate: 'DESC' },
    });
  }

  async createBankAccountBalance(dto: CreateBankAccountBalanceDto) {
    const balance = this.bankAccountBalanceRepo.create(dto);
    return this.bankAccountBalanceRepo.save(balance);
  }

  async updateBankAccountBalance(id: string, dto: UpdateBankAccountBalanceDto) {
    const balance = await this.bankAccountBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    Object.assign(balance, dto);
    return this.bankAccountBalanceRepo.save(balance);
  }

  async deleteBankAccountBalance(id: string) {
    const balance = await this.bankAccountBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    balance.isDeleted = true;
    return this.bankAccountBalanceRepo.save(balance);
  }

  // --- Cash Book Balances ---
  async getCashBookBalances(cashBookId: string) {
    return this.cashBookBalanceRepo.find({
      where: { cashBookId, isDeleted: false },
      order: { periodDate: 'DESC' },
    });
  }

  async createCashBookBalance(dto: CreateCashBookBalanceDto) {
    const balance = this.cashBookBalanceRepo.create(dto);
    return this.cashBookBalanceRepo.save(balance);
  }

  async updateCashBookBalance(id: string, dto: UpdateCashBookBalanceDto) {
    const balance = await this.cashBookBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    Object.assign(balance, dto);
    return this.cashBookBalanceRepo.save(balance);
  }

  async deleteCashBookBalance(id: string) {
    const balance = await this.cashBookBalanceRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!balance) throw new NotFoundException('Balance not found');
    balance.isDeleted = true;
    return this.cashBookBalanceRepo.save(balance);
  }
}
