import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpChartOfAccount } from '../entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../entities/erp_journal_entry_line.entity';

@Injectable()
export class AccountingCoreService {
  private readonly logger = new Logger(AccountingCoreService.name);

  constructor(
    @InjectRepository(ErpChartOfAccount)
    private readonly chartOfAccountRepo: Repository<ErpChartOfAccount>,
    @InjectRepository(ErpJournalEntry)
    private readonly journalEntryRepo: Repository<ErpJournalEntry>,
    @InjectRepository(ErpJournalEntryLine)
    private readonly journalEntryLineRepo: Repository<ErpJournalEntryLine>,
  ) {}

  async generateEntryNo(
    sourceType: 'BANK' | 'CASH',
    transDate: Date,
    branchId: string,
  ): Promise<string> {
    const date = transDate || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const prefix =
      sourceType === 'BANK' ? `UNC-${year}${month}` : `PC-${year}${month}`;

    const lastEntry = await this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.branchId = :branchId', { branchId })
      .andWhere('je.entryNo LIKE :prefix', { prefix: `${prefix}-%` })
      .orderBy('je.entryNo', 'DESC')
      .getOne();

    let nextCount = 1;
    if (lastEntry && lastEntry.entryNo) {
      const parts = lastEntry.entryNo.split('-');
      if (parts.length === 3) {
        const lastCount = parseInt(parts[2], 10);
        if (!isNaN(lastCount)) {
          nextCount = lastCount + 1;
        }
      }
    }

    const newEntryNo = `${prefix}-${String(nextCount).padStart(3, '0')}`;
    return newEntryNo;
  }

  async deleteJournalEntryBySource(sourceId: string, sourceType: string) {
    await this.journalEntryRepo.update(
      { sourceId, sourceType },
      { isDeleted: true },
    );
  }

  async createJournalEntry(data: {
    branchId: string;
    date: Date;
    description?: string;
    sourceType?: string;
    sourceId?: string;
    lines: {
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }) {
    const entryNo = await this.generateEntryNo(
      data.sourceType === 'BANK' ? 'BANK' : 'CASH',
      data.date,
      data.branchId,
    );

    const entry = this.journalEntryRepo.create({
      branchId: data.branchId,
      entryNo,
      date: data.date,
      description: data.description,
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      status: 'POSTED',
      lines: data.lines.map((l, index) =>
        this.journalEntryLineRepo.create({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
          sort: index,
        }),
      ),
    });

    return this.journalEntryRepo.save(entry);
  }

  async getJournalEntries(query: any) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const qb = this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
      .where('je.isDeleted = :isDeleted', { isDeleted: false });

    if (query.branchId) {
      qb.andWhere('je.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.startDate) {
      qb.andWhere('je.date >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('je.date <= :endDate', { endDate: query.endDate });
    }
    if (query.search) {
      qb.andWhere(
        '(je.entryNo ILIKE :search OR je.description ILIKE :search OR lines.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.accountId) {
      qb.andWhere('lines.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    qb.orderBy('je.date', 'DESC').addOrderBy('je.createdAt', 'DESC');
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

  async getChartOfAccounts(query: any) {
    const qb = this.chartOfAccountRepo
      .createQueryBuilder('coa')
      .where('coa.isDeleted = :isDeleted', { isDeleted: false });

    if (query.branchId) {
      qb.andWhere('coa.branchId = :branchId', { branchId: query.branchId });
    }

    qb.orderBy('coa.accountCode', 'ASC');

    return qb.getMany();
  }
}
