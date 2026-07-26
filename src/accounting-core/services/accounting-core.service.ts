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
    sourceType: 'BANK' | 'CASH' | 'INVOICE' | string,
    transDate: Date,
    branchId: string,
    isReceipt?: boolean,
    customPrefix?: string,
  ): Promise<string> {
    const date = transDate || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const yyyymmdd = `${year}${month}${day}`;

    let prefix = 'CT';
    if (customPrefix) {
      prefix = `${customPrefix}-${yyyymmdd}`;
    } else if (sourceType === 'BANK') {
      prefix = isReceipt ? `UNT-${yyyymmdd}` : `UNC-${yyyymmdd}`;
    } else if (sourceType === 'CASH') {
      prefix = isReceipt ? `PT-${yyyymmdd}` : `PC-${yyyymmdd}`;
    } else {
      prefix = `CT-${year}${month}`; // legacy fallback
    }

    const lastEntry = await this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.branchId = :branchId', { branchId })
      .andWhere('je.entryNo LIKE :prefix', { prefix: `${prefix}-%` })
      .orderBy('je.entryNo', 'DESC')
      .getOne();

    let nextCount = 1;
    if (lastEntry && lastEntry.entryNo) {
      const parts = lastEntry.entryNo.split('-');
      const lastPart = parts[parts.length - 1];
      const lastCount = parseInt(lastPart, 10);
      if (!isNaN(lastCount)) {
        nextCount = lastCount + 1;
      }
    }

    const newEntryNo = `${prefix}-${String(nextCount).padStart(2, '0')}`;
    return newEntryNo;
  }

  async deleteJournalEntryBySource(sourceId: string, sourceType: string) {
    await this.journalEntryRepo.update(
      { sourceId, sourceType },
      { isDeleted: true },
    );
  }

  async updateJournalEntrySubject(
    sourceId: string,
    sourceType: string,
    subjectName: string | null,
  ) {
    await this.journalEntryRepo.update(
      { sourceId, sourceType, isDeleted: false },
      { subjectName: subjectName ?? undefined },
    );
  }

  async updateJournalEntryBranch(
    sourceId: string,
    sourceType: string,
    branchId: string,
  ): Promise<void> {
    await this.journalEntryRepo.update(
      { sourceId, sourceType, isDeleted: false },
      { branchId },
    );
  }

  async getJournalEntriesBySource(sourceId: string, sourceType: string) {
    return this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
      .where('je.sourceId = :sourceId', { sourceId })
      .andWhere('je.sourceType = :sourceType', { sourceType })
      .andWhere('je.isDeleted = false')
      .orderBy('je.date', 'DESC')
      .addOrderBy('je.createdAt', 'DESC')
      .getMany();
  }

  async getLatestJournalEntryBySource(sourceId: string, sourceType: string) {
    return this.journalEntryRepo
      .createQueryBuilder('je')
      .where('je.sourceId = :sourceId', { sourceId })
      .andWhere('je.sourceType = :sourceType', { sourceType })
      .andWhere('je.isDeleted = false')
      .orderBy('je.date', 'DESC')
      .addOrderBy('je.createdAt', 'DESC')
      .getOne();
  }

  async createJournalEntry(data: {
    entryNoPrefix?: string;
    entryNo?: string;
    branchId: string;
    date: Date;
    documentDate?: Date;
    description?: string;
    subjectName?: string;
    sourceType?: string;
    sourceId?: string;
    reference?: string | null;
    isReceipt?: boolean;
    lines: {
      accountId: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
  }) {
    const entryNo =
      data.entryNo ??
      (await this.generateEntryNo(
        data.sourceType || 'BANK',
        data.date,
        data.branchId,
        data.isReceipt,
        data.entryNoPrefix,
      ));

    const debits = data.lines.filter((l) => l.debit > 0).map((l) => ({ ...l }));
    const credits = data.lines
      .filter((l) => l.credit > 0)
      .map((l) => ({ ...l }));
    const pairedLines: typeof data.lines = [];

    let i = 0,
      j = 0;
    while (i < debits.length && j < credits.length) {
      const d = debits[i];
      const c = credits[j];
      const amount = Math.min(d.debit, c.credit);

      if (amount > 0) {
        pairedLines.push({
          accountId: d.accountId,
          debit: amount,
          credit: 0,
          description: d.description,
        });
        pairedLines.push({
          accountId: c.accountId,
          debit: 0,
          credit: amount,
          description: c.description,
        });
      }

      d.debit -= amount;
      c.credit -= amount;

      if (d.debit < 0.01) i++;
      if (c.credit < 0.01) j++;
    }

    while (i < debits.length) {
      if (debits[i].debit > 0) pairedLines.push(debits[i]);
      i++;
    }
    while (j < credits.length) {
      if (credits[j].credit > 0) pairedLines.push(credits[j]);
      j++;
    }

    const entry = this.journalEntryRepo.create({
      branchId: data.branchId,
      entryNo,
      date: data.date,
      documentDate: data.documentDate,
      description: data.description,
      subjectName: data.subjectName,
      sourceId: data.sourceId,
      sourceType: data.sourceType,
      reference: data.reference,
      status: 'POSTED',
      lines: pairedLines.map((l, index) =>
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
      .leftJoinAndSelect('je.branch', 'branch')
      .where('je.isDeleted = :isDeleted', { isDeleted: false });

    if (query.branchId) {
      qb.andWhere('je.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.startDate) {
      qb.andWhere('je.date >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      const eDate =
        query.endDate.length === 10
          ? `${query.endDate} 23:59:59.999`
          : query.endDate;
      qb.andWhere('je.date <= :endDate', { endDate: eDate });
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

  async getJournalEntryById(id: string) {
    return this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
      .leftJoinAndSelect('je.branch', 'branch')
      .where('je.id = :id', { id })
      .getOne();
  }

  async getChartOfAccounts(query: any) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;

    const qb = this.chartOfAccountRepo
      .createQueryBuilder('coa')
      .where('coa.isDeleted = :isDeleted', { isDeleted: false });

    if (query.search) {
      qb.andWhere(
        '(coa.accountCode ILIKE :search OR coa.accountName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('coa.accountCode', 'ASC');
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

  async createChartOfAccount(dto: any) {
    const account = this.chartOfAccountRepo.create({
      accountCode: dto.account_code,
      accountName: dto.account_name,
      accountType: dto.account_type,
      parentId: dto.parent_account_id || null,
      isActive: dto.is_active ?? true,
    });
    return this.chartOfAccountRepo.save(account);
  }

  async updateChartOfAccount(id: string, dto: any) {
    const account = await this.chartOfAccountRepo.findOne({ where: { id } });
    if (!account) {
      throw new Error('Account not found');
    }
    if (dto.account_code) account.accountCode = dto.account_code;
    if (dto.account_name) account.accountName = dto.account_name;
    if (dto.account_type) account.accountType = dto.account_type;
    if (dto.parent_account_id !== undefined)
      account.parentId = dto.parent_account_id;
    if (dto.is_active !== undefined) account.isActive = dto.is_active;
    return this.chartOfAccountRepo.save(account);
  }

  async deleteChartOfAccount(id: string) {
    return this.chartOfAccountRepo.update(id, { isDeleted: true });
  }
}
