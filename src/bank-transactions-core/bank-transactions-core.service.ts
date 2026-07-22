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

import { ErpBankStatementFile } from './entities/erp_bank_statement_file.entity';

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
    @InjectRepository(ErpBankStatementFile)
    private readonly statementFileRepo: Repository<ErpBankStatementFile>,
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
      .leftJoinAndSelect('txn.invoiceNetOffs', 'invoiceNetOffs')
      .leftJoinAndSelect('invoiceNetOffs.invoice', 'invoice')
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

    if (filter.correspondentAccount) {
      qb.andWhere('txn.correspondentAccount = :correspondentAccount', {
        correspondentAccount: filter.correspondentAccount,
      });
    }
    if (filter.correspondentName) {
      qb.andWhere('txn.correspondentName = :correspondentName', {
        correspondentName: filter.correspondentName,
      });
    }

    if (filter.tagIds && filter.tagIds.length > 0) {
      qb.innerJoin(
        'sys_entity_tags',
        'et',
        `et.entity_id = txn.id AND et.entity_type = 'bank_transaction'`,
      ).andWhere('et.tag_id IN (:...tagIds)', { tagIds: filter.tagIds });
    }

    if (filter.column_filters) {
      try {
        const cFilters = JSON.parse(filter.column_filters) as Record<
          string,
          string[]
        >;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          let filterField = '';
          const netOffSubquery = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
          const remainingAmountSubquery = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

          if (col === 'account') {
            if (filter.sourceType === 'BANK') filterField = 'txn.bankAccountId';
            else if (filter.sourceType === 'CASH')
              filterField = 'txn.cashBookId';
            else filterField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
          } else if (col === 'transDate')
            filterField = "TO_CHAR(txn.transDate, 'DD/MM/YYYY')";
          else if (col === 'description') filterField = 'txn.description';
          else if (col === 'thu') filterField = 'txn.creditAmount';
          else if (col === 'chi') filterField = 'txn.debitAmount';
          else if (col === 'netOffAmount') filterField = netOffSubquery;
          else if (col === 'remainingAmount')
            filterField = remainingAmountSubquery;
          else if (col === 'balance') filterField = 'txn.balance';
          else if (col === 'correspondentName')
            filterField = 'txn.correspondentName';
          else if (col === 'correspondentAccount')
            filterField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            filterField = 'txn.correspondentBank';
          else if (col === 'branch') filterField = 'txn.branchId';
          else if (col === 'referenceNumber')
            filterField = 'txn.referenceNumber';

          if (filterField) {
            if (col === 'transDate') {
              qb.andWhere(`${filterField} IN (:...vals_${col})`, {
                [`vals_${col}`]: vals,
              });
            } else {
              qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
                [`vals_${col}`]: vals,
              });
            }
          }
        }
      } catch (e) {}
    }

    if (filter.column_search) {
      try {
        const cSearch = JSON.parse(filter.column_search) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          let searchField = '';
          if (col === 'account') {
            if (filter.sourceType === 'BANK')
              searchField = 'bankAccount.bankName'; // Note: ILIKE on relations needs careful join, already joined 'bankAccount' and 'cashBook'
            else if (filter.sourceType === 'CASH')
              searchField = 'cashBook.name';
            else searchField = 'COALESCE(bankAccount.bankName, cashBook.name)';
          } else if (col === 'transDate')
            searchField = "TO_CHAR(txn.transDate, 'DD/MM/YYYY')";
          else if (col === 'description') searchField = 'txn.description';
          else if (col === 'thu') searchField = 'txn.creditAmount';
          else if (col === 'chi') searchField = 'txn.debitAmount';
          else if (col === 'balance') searchField = 'txn.balance';
          else if (col === 'correspondentName')
            searchField = 'txn.correspondentName';
          else if (col === 'correspondentAccount')
            searchField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            searchField = 'txn.correspondentBank';
          else if (col === 'branch') searchField = 'branch.name';
          else if (col === 'referenceNumber')
            searchField = 'txn.referenceNumber';

          if (searchField) {
            if (col === 'transDate') {
              qb.andWhere(`${searchField} ILIKE :search_${col}`, {
                [`search_${col}`]: `%${val}%`,
              });
            } else {
              qb.andWhere(`CAST(${searchField} AS TEXT) ILIKE :search_${col}`, {
                [`search_${col}`]: `%${val}%`,
              });
            }
          }
        }
      } catch (e) {}
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

  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    sourceType?: 'BANK' | 'CASH',
  ) {
    const qb = this.transactionRepo.createQueryBuilder('txn');

    if (sourceType) {
      qb.where('txn.sourceType = :sourceType', { sourceType });
    } else {
      qb.where('1 = 1');
    }

    let selectField = '';
    let labelField = '';

    if (column === 'account') {
      if (sourceType === 'BANK') {
        qb.leftJoin('txn.bankAccount', 'bankAccount');
        selectField = 'txn.bankAccountId';
        labelField = `COALESCE(bankAccount.bankName, '') || ' - ' || COALESCE(bankAccount.accountNumber, '')`;
      } else if (sourceType === 'CASH') {
        qb.leftJoin('txn.cashBook', 'cashBook');
        selectField = 'txn.cashBookId';
        labelField = 'cashBook.name';
      } else {
        qb.leftJoin('txn.bankAccount', 'bankAccount');
        qb.leftJoin('txn.cashBook', 'cashBook');
        selectField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
        labelField = `COALESCE(bankAccount.bankName || ' - ' || bankAccount.accountNumber, cashBook.name)`;
      }
    } else if (column === 'transDate')
      selectField = "TO_CHAR(txn.transDate, 'DD/MM/YYYY')";
    else if (column === 'description') selectField = 'txn.description';
    else if (column === 'thu') selectField = 'txn.creditAmount';
    else if (column === 'chi') selectField = 'txn.debitAmount';
    else if (column === 'netOffAmount')
      selectField = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
    else if (column === 'remainingAmount')
      selectField = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0))`;
    else if (column === 'balance') selectField = 'txn.balance';
    else if (column === 'correspondentName')
      selectField = 'txn.correspondentName';
    else if (column === 'correspondentAccount')
      selectField = 'txn.correspondentAccount';
    else if (column === 'correspondentBank')
      selectField = 'txn.correspondentBank';
    else if (column === 'branch') {
      qb.leftJoin('txn.branch', 'branch');
      selectField = 'txn.branchId';
      labelField = 'branch.name';
    } else if (column === 'referenceNumber')
      selectField = 'txn.referenceNumber';
    else if (column === 'partner')
      selectField =
        "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";
    else return { items: [], total: 0, page, pageSize, totalPages: 0 };

    if (!labelField) labelField = selectField;

    qb.select(`DISTINCT ${selectField}`, 'value');
    qb.addSelect(`MAX(${labelField})`, 'label');
    qb.andWhere(`${selectField} IS NOT NULL`);
    if (column !== 'transDate') {
      qb.andWhere(`CAST(${selectField} AS TEXT) != ''`);
    } else {
      qb.andWhere(`${selectField} != ''`);
    }
    qb.groupBy(selectField);

    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          let filterField = '';
          const netOffSubquery = `COALESCE((SELECT SUM(net_off_amount) FROM erp_invoice_voucher_netoff WHERE bank_transaction_id = txn.id), 0)`;
          const remainingAmountSubquery = `(GREATEST(COALESCE(txn.credit_amount, 0), COALESCE(txn.debit_amount, 0)) - ${netOffSubquery})`;

          if (col === 'account') {
            if (sourceType === 'BANK') filterField = 'txn.bankAccountId';
            else if (sourceType === 'CASH') filterField = 'txn.cashBookId';
            else filterField = 'COALESCE(txn.bankAccountId, txn.cashBookId)';
          } else if (col === 'transDate')
            filterField = "TO_CHAR(txn.transDate, 'DD/MM/YYYY')";
          else if (col === 'description') filterField = 'txn.description';
          else if (col === 'thu') filterField = 'txn.creditAmount';
          else if (col === 'chi') filterField = 'txn.debitAmount';
          else if (col === 'netOffAmount') filterField = netOffSubquery;
          else if (col === 'remainingAmount')
            filterField = remainingAmountSubquery;
          else if (col === 'balance') filterField = 'txn.balance';
          else if (col === 'correspondentName')
            filterField = 'txn.correspondentName';
          else if (col === 'correspondentAccount')
            filterField = 'txn.correspondentAccount';
          else if (col === 'correspondentBank')
            filterField = 'txn.correspondentBank';
          else if (col === 'branch') filterField = 'txn.branchId';
          else if (col === 'referenceNumber')
            filterField = 'txn.referenceNumber';
          else if (col === 'partner')
            filterField =
              "COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, ''))";

          if (filterField) {
            if (col === 'transDate') {
              qb.andWhere(`${filterField} IN (:...vals_${col})`, {
                [`vals_${col}`]: vals,
              });
            } else {
              qb.andWhere(`CAST(${filterField} AS TEXT) IN (:...vals_${col})`, {
                [`vals_${col}`]: vals,
              });
            }
          }
        }
      } catch (e) {}
    }

    if (search) {
      if (column === 'transDate') {
        qb.andWhere(`${labelField} ILIKE :search`, {
          search: `%${search}%`,
        });
      } else {
        qb.andWhere(`CAST(${labelField} AS TEXT) ILIKE :search`, {
          search: `%${search}%`,
        });
      }
    }

    qb.orderBy('value', 'ASC');

    const countQb = qb.clone();
    countQb.expressionMap.groupBys = [];
    const totalRaw = await countQb
      .orderBy()
      .select(`COUNT(DISTINCT ${selectField})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    qb.offset((page - 1) * pageSize).limit(pageSize);
    const results = await qb.getRawMany();

    return {
      items: results
        .map((r) => ({
          value: String(r.value),
          label: r.label ? String(r.label) : String(r.value),
        }))
        .filter((r) => r.value),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPartnerStats(filter: BankTransactionFilterDto) {
    const page = filter.page || 1;
    const pageSize = filter.pageSize || 20;

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
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

    const groupField =
      "COALESCE(NULLIF(txn.correspondentAccount, ''), NULLIF(txn.correspondentName, ''), 'Khác')";

    qb.andWhere(
      "COALESCE(NULLIF(txn.correspondentAccount, ''), NULLIF(txn.correspondentName, '')) IS NOT NULL",
    );

    if (filter.column_filters) {
      try {
        const cFilters = JSON.parse(filter.column_filters) as Record<
          string,
          string[]
        >;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          if (col === 'correspondentAccount') {
            qb.andWhere(`txn.correspondentAccount IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          } else if (col === 'correspondentName') {
            qb.andWhere(`txn.correspondentName IN (:...vals_${col})`, {
              [`vals_${col}`]: vals,
            });
          } else if (col === 'partner') {
            qb.andWhere(
              `COALESCE(NULLIF(txn.correspondentName, ''), NULLIF(txn.correspondentAccount, '')) IN (:...vals_${col})`,
              {
                [`vals_${col}`]: vals,
              },
            );
          }
        }
      } catch (e) {}
    }

    if (filter.column_search) {
      try {
        const cSearch = JSON.parse(filter.column_search) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          if (col === 'correspondentAccount') {
            qb.andWhere(`txn.correspondentAccount ILIKE :search_${col}`, {
              [`search_${col}`]: `%${val}%`,
            });
          } else if (col === 'correspondentName') {
            qb.andWhere(`txn.correspondentName ILIKE :search_${col}`, {
              [`search_${col}`]: `%${val}%`,
            });
          } else if (col === 'partner') {
            qb.andWhere(
              `(
              txn.correspondentAccount ILIKE :search_${col} OR
              txn.correspondentName ILIKE :search_${col}
            )`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          } else if (col === 'invoiceSubject') {
            qb.andWhere(
              `EXISTS (
              SELECT 1 FROM erp_invoice_voucher_netoff n
              JOIN erp_invoices i ON n.invoice_id = i.id
              WHERE n.bank_transaction_id = txn.id
              AND (i.seller_name ILIKE :search_${col} OR i.buyer_name ILIKE :search_${col} OR i.seller_tax_code ILIKE :search_${col} OR i.buyer_tax_code ILIKE :search_${col})
            )`,
              {
                [`search_${col}`]: `%${val}%`,
              },
            );
          }
        }
      } catch (e) {}
    }

    const countQb = qb.clone();
    const totalRaw = await countQb
      .select(`COUNT(DISTINCT ${groupField})`, 'cnt')
      .getRawOne();
    const total = parseInt(totalRaw?.cnt || '0', 10);

    qb.select(groupField, 'groupId')
      .addSelect('MAX(txn.correspondentAccount)', 'correspondentAccount')
      .addSelect('MAX(txn.correspondentName)', 'correspondentName')
      .addSelect('SUM(COALESCE(txn.creditAmount, 0))', 'totalCredit')
      .addSelect('SUM(COALESCE(txn.debitAmount, 0))', 'totalDebit')
      .groupBy(groupField);

    if (filter.sortBy) {
      const order = filter.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      if (filter.sortBy === 'correspondentAccount') {
        qb.orderBy('MAX(txn.correspondentAccount)', order);
      } else if (filter.sortBy === 'correspondentName') {
        qb.orderBy('MAX(txn.correspondentName)', order);
      } else if (filter.sortBy === 'totalCredit') {
        qb.orderBy('SUM(COALESCE(txn.creditAmount, 0))', order);
      } else if (filter.sortBy === 'totalDebit') {
        qb.orderBy('SUM(COALESCE(txn.debitAmount, 0))', order);
      } else {
        qb.orderBy(
          'SUM(COALESCE(txn.creditAmount, 0)) + SUM(COALESCE(txn.debitAmount, 0))',
          'DESC',
        );
      }
    } else {
      qb.orderBy(
        'SUM(COALESCE(txn.creditAmount, 0)) + SUM(COALESCE(txn.debitAmount, 0))',
        'DESC',
      );
    }
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const items = await qb.getRawMany();

    let subjectsMap: Record<string, string> = {};
    if (items.length > 0) {
      const groupConditions = items
        .map((item) => {
          const escapedId = String(item.groupId).replace(/'/g, "''");
          return `(COALESCE(NULLIF(t2.correspondent_account, ''), NULLIF(t2.correspondent_name, ''), 'Khác') = '${escapedId}')`;
        })
        .join(' OR ');

      const subjectQuery = `
        SELECT 
          COALESCE(NULLIF(t2.correspondent_account, ''), NULLIF(t2.correspondent_name, ''), 'Khác') as group_id,
          CASE WHEN inv.direction = 'IN' THEN CONCAT_WS(' - ', NULLIF(inv.seller_tax_code, ''), inv.seller_name) ELSE CONCAT_WS(' - ', NULLIF(inv.buyer_tax_code, ''), inv.buyer_name) END as subject
        FROM erp_invoice_voucher_netoff netoff
        INNER JOIN erp_invoices inv ON inv.id = netoff.invoice_id
        INNER JOIN erp_bank_transactions t2 ON t2.id = netoff.bank_transaction_id
        WHERE t2.is_deleted = false
          AND (${groupConditions})
      `;
      const subjectsRows = await this.transactionRepo.query(subjectQuery);

      const groupedSubjects = subjectsRows.reduce((acc: any, curr: any) => {
        if (!curr.subject) return acc;
        if (!acc[curr.group_id]) acc[curr.group_id] = new Set();
        acc[curr.group_id].add(curr.subject);
        return acc;
      }, {});

      for (const [groupId, set] of Object.entries(groupedSubjects)) {
        subjectsMap[groupId] = Array.from(set as Set<string>).join(', ');
      }
    }

    return {
      items: items.map((item) => ({
        id: item.groupId,
        correspondentAccount: item.correspondentAccount,
        correspondentName: item.correspondentName,
        totalCredit: parseFloat(item.totalCredit) || 0,
        totalDebit: parseFloat(item.totalDebit) || 0,
        invoiceSubject: subjectsMap[item.groupId] || null,
      })),
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

    if (filter.correspondentAccount) {
      qb.andWhere('txn.correspondentAccount = :correspondentAccount', {
        correspondentAccount: filter.correspondentAccount,
      });
    }
    if (filter.correspondentName) {
      qb.andWhere('txn.correspondentName = :correspondentName', {
        correspondentName: filter.correspondentName,
      });
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
    if (!txn) return;

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
      `SELECT n.id, n.net_off_amount, i.direction, i.seller_name, i.buyer_name, i.invoice_no, i.serial_no, i.branch_id, i.description as invoice_desc
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

    type Group = {
      subject: string | null;
      amount: number;
      counterpartAccountId: string | null;
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
          const invoiceRef = row.serial_no
            ? `${row.invoice_no}-${row.serial_no}`
            : row.invoice_no;
          const desc = row.invoice_desc
            ? `${invoiceRef}_${baseDescription} - ${row.invoice_desc}`
            : `${invoiceRef}_${baseDescription}`;
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

    // Get existing date before deleting journal entries
    const existingEntries = await this.dataSource.query(
      `SELECT date FROM erp_journal_entries WHERE source_id = $1 AND source_type = $2 AND is_deleted = false LIMIT 1`,
      [txn.id, txn.sourceType],
    );
    const postingDate =
      existingEntries.length > 0 ? existingEntries[0].date : new Date();

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

    // Create one journal entry per valid group
    const validGroups = groups.filter((g) => g.counterpartAccountId);
    for (let i = 0; i < validGroups.length; i++) {
      const group = validGroups[i];
      // Single group → no suffix; multiple groups → a, b, c...
      const entryNo =
        validGroups.length === 1
          ? baseEntryNo
          : `${baseEntryNo}${String.fromCharCode(97 + i)}`;

      const counterpartAccountId = group.counterpartAccountId as string;
      const debitAccount = isReceipt ? defaultAccountId : counterpartAccountId;
      const creditAccount = isReceipt ? counterpartAccountId : defaultAccountId;

      await this.accountingCoreService.createJournalEntry({
        entryNo,
        branchId: group.branchId,
        date: postingDate,
        documentDate: txn.transDate,
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

  // --- Bank Statement Files ---
  async getStatementFiles(params: {
    page?: number;
    pageSize?: number;
    branchId?: string;
    bankAccountId?: string;
    cashBookId?: string;
  }) {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;

    const qb = this.statementFileRepo
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.bankAccount', 'bankAccount')
      .leftJoinAndSelect('file.cashBook', 'cashBook')
      .where('file.isDeleted = :isDeleted', { isDeleted: false });

    if (params.branchId) {
      qb.andWhere('file.branchId = :branchId', { branchId: params.branchId });
    }
    if (params.bankAccountId) {
      qb.andWhere('file.bankAccountId = :bankAccountId', {
        bankAccountId: params.bankAccountId,
      });
    }
    if (params.cashBookId) {
      qb.andWhere('file.cashBookId = :cashBookId', {
        cashBookId: params.cashBookId,
      });
    }

    qb.orderBy('file.periodDate', 'ASC').addOrderBy('file.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    // Query sys_file for file metadata
    let mappedItems = items;
    if (items.length > 0) {
      const fileIds = items.map((i) => i.fileId);
      const sysFiles = await this.dataSource.query(
        `SELECT id, filename_download, filename_disk FROM sys_files WHERE id = ANY($1)`,
        [fileIds],
      );
      const sysFileMap = new Map(sysFiles.map((f: any) => [f.id, f]));

      mappedItems = items.map((item) => {
        const fileMeta = sysFileMap.get(item.fileId) as any;
        return {
          ...item,
          fileName: fileMeta
            ? fileMeta.filename_download || fileMeta.filename_disk
            : 'Unknown file',
        };
      }) as any;
    }

    return {
      items: mappedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createStatementFile(
    dto: import('./dto/create-bank-statement-file.dto').CreateBankStatementFileDto,
  ) {
    if (!dto.bankAccountId && !dto.cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }
    const file = this.statementFileRepo.create(dto);
    return this.statementFileRepo.save(file);
  }

  async deleteStatementFile(id: string) {
    const file = await this.statementFileRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    file.isDeleted = true;
    return this.statementFileRepo.save(file);
  }
}
