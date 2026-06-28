import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
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
import { parseTcbCsv } from './parsers/tcb.parser';
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
  ) {}

  // --- Bank Accounts ---
  async getBankAccounts(branchId?: string) {
    const where: any = { isDeleted: false };
    if (branchId) where.branchId = branchId;

    const accounts = await this.bankAccountRepo.find({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });

    // Fetch latest balance for each account
    const accountsWithBalance = await Promise.all(
      accounts.map(async (acc) => {
        const balance = await this.bankAccountBalanceRepo.findOne({
          where: { bankAccountId: acc.id, isDeleted: false },
          order: { periodDate: 'DESC' },
        });
        return {
          ...acc,
          openingBalance: balance ? Number(balance.openingBalance) : 0,
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
  async getCashBooks(branchId?: string) {
    const where: any = { isDeleted: false };
    if (branchId) where.branchId = branchId;

    const books = await this.cashBookRepo.find({
      where,
      relations: ['branch'],
      order: { createdAt: 'DESC' },
    });

    const booksWithBalance = await Promise.all(
      books.map(async (book) => {
        const balance = await this.cashBookBalanceRepo.findOne({
          where: { cashBookId: book.id, isDeleted: false },
          order: { periodDate: 'DESC' },
        });
        return {
          ...book,
          openingBalance: balance ? Number(balance.openingBalance) : 0,
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
      qb.andWhere('txn.transDate <= :endDate', { endDate: filter.endDate });
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

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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

  async importFile(
    file: Express.Multer.File,
    branchId: string,
    bankAccountId?: string,
    cashBookId?: string,
  ) {
    if (!bankAccountId && !cashBookId) {
      throw new BadRequestException(
        'Must provide either bankAccountId or cashBookId',
      );
    }

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
        dtos = await parseBidvXlsx(
          file.buffer,
          branchId,
          bankAccountId,
          cashBookId,
        );
      }
    } else {
      throw new BadRequestException(
        'Unsupported file format. Please upload .csv or .xlsx',
      );
    }

    if (dtos.length === 0) {
      throw new BadRequestException('No valid transactions found in file');
    }

    const importBatchId = crypto.randomUUID();
    const entities = dtos.map((dto) =>
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
