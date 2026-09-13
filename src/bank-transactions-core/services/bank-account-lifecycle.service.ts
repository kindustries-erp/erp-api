import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpBankAccount } from '../entities/erp_bank_account.entity';
import { ErpBankTransaction } from '../entities/erp_bank_transaction.entity';
import { ErpBankAccountBalance } from '../entities/erp_bank_account_balance.entity';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '../dto/create-bank-account.dto';

@Injectable()
export class BankAccountLifecycleService {
  constructor(
    @InjectRepository(ErpBankAccount)
    private readonly bankAccountRepo: Repository<ErpBankAccount>,
    @InjectRepository(ErpBankTransaction)
    private readonly transactionRepo: Repository<ErpBankTransaction>,
    @InjectRepository(ErpBankAccountBalance)
    private readonly bankAccountBalanceRepo: Repository<ErpBankAccountBalance>,
  ) {}

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

        const lastTxnInfo = await this.transactionRepo
          .createQueryBuilder('txn')
          .select('MAX(txn.createdAt)', 'lastUploadDate')
          .addSelect('MAX(txn.transDate)', 'lastStatementDate')
          .where('txn.bankAccountId = :id', { id: acc.id })
          .andWhere('txn.isDeleted = false')
          .getRawOne();

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
          lastUploadDate: lastTxnInfo?.lastUploadDate || null,
          lastStatementDate: lastTxnInfo?.lastStatementDate || null,
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
}
