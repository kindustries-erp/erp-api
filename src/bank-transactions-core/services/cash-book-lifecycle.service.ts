import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpCashBook } from '../entities/erp_cash_book.entity';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { ErpCashBookBalance } from '../entities/erp_cash_book_balance.entity';
import {
  CreateCashBookDto,
  UpdateCashBookDto,
} from '../dto/create-cash-book.dto';

@Injectable()
export class CashBookLifecycleService {
  constructor(
    @InjectRepository(ErpCashBook)
    private readonly cashBookRepo: Repository<ErpCashBook>,
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    @InjectRepository(ErpCashBookBalance)
    private readonly cashBookBalanceRepo: Repository<ErpCashBookBalance>,
  ) {}

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

        const lastTxnInfo = await this.transactionRepo
          .createQueryBuilder('txn')
          .select('MAX(txn.createdAt)', 'lastUploadDate')
          .addSelect('MAX(txn.transDate)', 'lastStatementDate')
          .where('txn.cashBookId = :id', { id: book.id })
          .andWhere('txn.isDeleted = false')
          .getRawOne();

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
          lastUploadDate: lastTxnInfo?.lastUploadDate || null,
          lastStatementDate: lastTxnInfo?.lastStatementDate || null,
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
}
