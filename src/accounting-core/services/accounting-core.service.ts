import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(500, Number(query.pageSize) || 50));

    const qb = this.chartOfAccountRepo
      .createQueryBuilder('coa')
      .leftJoinAndSelect('coa.parent', 'parent')
      .where('coa.isDeleted = :isDeleted', { isDeleted: false });

    if (query.search && String(query.search).trim()) {
      const search = `%${String(query.search).trim()}%`;
      qb.andWhere(
        '(coa.accountCode ILIKE :search OR coa.accountName ILIKE :search)',
        { search },
      );
    }

    // Column specific searches
    if (query.accountCodeSearch && String(query.accountCodeSearch).trim()) {
      const codeSearch = `%${String(query.accountCodeSearch).trim()}%`;
      qb.andWhere('coa.accountCode ILIKE :codeSearch', { codeSearch });
    }

    if (query.accountNameSearch && String(query.accountNameSearch).trim()) {
      const nameSearch = `%${String(query.accountNameSearch).trim()}%`;
      qb.andWhere('coa.accountName ILIKE :nameSearch', { nameSearch });
    }

    if (query.parentAccountSearch && String(query.parentAccountSearch).trim()) {
      const parentSearch = `%${String(query.parentAccountSearch).trim()}%`;
      qb.andWhere(
        '(parent.accountCode ILIKE :parentSearch OR parent.accountName ILIKE :parentSearch)',
        { parentSearch },
      );
    }

    // Column options checkbox filters
    const accountCode = query.accountCode || query.account_code;
    if (accountCode) {
      const codes = Array.isArray(accountCode)
        ? accountCode
        : typeof accountCode === 'string'
          ? accountCode.split(',').map((c) => c.trim()).filter(Boolean)
          : [];
      if (codes.length > 0) {
        qb.andWhere('coa.accountCode IN (:...accountCodes)', { accountCodes: codes });
      }
    }

    const accountName = query.accountName || query.account_name;
    if (accountName) {
      const names = Array.isArray(accountName)
        ? accountName
        : typeof accountName === 'string'
          ? accountName.split(',').map((n) => n.trim()).filter(Boolean)
          : [];
      if (names.length > 0) {
        qb.andWhere('coa.accountName IN (:...accountNames)', { accountNames: names });
      }
    }

    const parentAccount = query.parentAccount || query.parentId || query.parent_id;
    if (parentAccount) {
      const parents = Array.isArray(parentAccount)
        ? parentAccount
        : typeof parentAccount === 'string'
          ? parentAccount.split(',').map((p) => p.trim()).filter(Boolean)
          : [];
      if (parents.length > 0) {
        const hasBlank = parents.includes('__BLANK__');
        const nonBlank = parents.filter((p) => p !== '__BLANK__');
        if (hasBlank && nonBlank.length > 0) {
          qb.andWhere(
            '(coa.parentId IS NULL OR coa.parentId IN (:...fParents) OR parent.accountCode IN (:...fParents))',
            { fParents: nonBlank },
          );
        } else if (hasBlank) {
          qb.andWhere('coa.parentId IS NULL');
        } else if (nonBlank.length > 0) {
          qb.andWhere(
            '(coa.parentId IN (:...fParents) OR parent.accountCode IN (:...fParents))',
            { fParents: nonBlank },
          );
        }
      }
    }

    const accountType = query.accountType || query.account_type;
    if (accountType) {
      if (Array.isArray(accountType)) {
        qb.andWhere('coa.accountType IN (:...accountTypes)', {
          accountTypes: accountType,
        });
      } else if (typeof accountType === 'string' && accountType.trim()) {
        const types = accountType.split(',').map((t) => t.trim()).filter(Boolean);
        if (types.length > 1) {
          qb.andWhere('coa.accountType IN (:...accountTypes)', {
            accountTypes: types,
          });
        } else {
          qb.andWhere('coa.accountType = :accountType', {
            accountType: types[0] || accountType,
          });
        }
      }
    }

    const isActive = query.isActive ?? query.is_active;
    if (isActive !== undefined && isActive !== null && isActive !== '') {
      const activeVal = isActive === true || isActive === 'true' || isActive === 1 || isActive === '1';
      qb.andWhere('coa.isActive = :isActive', { isActive: activeVal });
    }

    // Dynamic sorting
    const sortParam = query.sort || query.sorts;
    if (sortParam) {
      const sortList = Array.isArray(sortParam)
        ? sortParam
        : typeof sortParam === 'string'
          ? sortParam.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

      let hasOrder = false;
      for (const sortField of sortList) {
        const isDesc = sortField.startsWith('-');
        const rawField = isDesc ? sortField.substring(1) : sortField;
        const validFields: Record<string, string> = {
          accountCode: 'coa.accountCode',
          account_code: 'coa.accountCode',
          accountName: 'coa.accountName',
          account_name: 'coa.accountName',
          accountType: 'coa.accountType',
          account_type: 'coa.accountType',
          parentAccount: 'parent.accountCode',
          parent_account: 'parent.accountCode',
          parentId: 'parent.accountCode',
          createdAt: 'coa.createdAt',
          created_at: 'coa.createdAt',
          updatedAt: 'coa.updatedAt',
          updated_at: 'coa.updatedAt',
          isActive: 'coa.isActive',
          is_active: 'coa.isActive',
        };

        if (validFields[rawField]) {
          if (!hasOrder) {
            qb.orderBy(validFields[rawField], isDesc ? 'DESC' : 'ASC');
            hasOrder = true;
          } else {
            qb.addOrderBy(validFields[rawField], isDesc ? 'DESC' : 'ASC');
          }
        }
      }
      if (!hasOrder) {
        qb.orderBy('coa.accountCode', 'ASC');
      }
    } else {
      qb.orderBy('coa.accountCode', 'ASC');
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getChartOfAccountsColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
  ) {
    const qb = this.chartOfAccountRepo
      .createQueryBuilder('coa')
      .leftJoin('coa.parent', 'parent')
      .where('coa.isDeleted = :isDeleted', { isDeleted: false });

    // Cascading filters
    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          if (col === 'accountType' || col === 'account_type') {
            qb.andWhere('coa.accountType IN (:...fAccountTypes)', { fAccountTypes: vals });
          } else if (col === 'isActive' || col === 'is_active') {
            const hasTrue = vals.includes('true');
            const hasFalse = vals.includes('false');
            if (hasTrue && !hasFalse) qb.andWhere('coa.isActive = :fActive', { fActive: true });
            else if (hasFalse && !hasTrue) qb.andWhere('coa.isActive = :fActive', { fActive: false });
          } else if (col === 'accountCode' || col === 'account_code') {
            qb.andWhere('coa.accountCode IN (:...fAccountCodes)', { fAccountCodes: vals });
          } else if (col === 'accountName' || col === 'account_name') {
            qb.andWhere('coa.accountName IN (:...fAccountNames)', { fAccountNames: vals });
          } else if (col === 'parentAccount' || col === 'parentId') {
            const hasBlank = vals.includes('__BLANK__');
            const nonBlank = vals.filter((v) => v !== '__BLANK__');
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                '(coa.parentId IS NULL OR coa.parentId IN (:...fParents) OR parent.accountCode IN (:...fParents))',
                { fParents: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere('coa.parentId IS NULL');
            } else if (nonBlank.length > 0) {
              qb.andWhere(
                '(coa.parentId IN (:...fParents) OR parent.accountCode IN (:...fParents))',
                { fParents: nonBlank },
              );
            }
          }
        }
      } catch (e) {}
    }

    if (column === 'accountCode' || column === 'account_code') {
      qb.select('DISTINCT coa.accountCode', 'value');
      qb.andWhere("coa.accountCode IS NOT NULL AND coa.accountCode != ''");
      if (search && search.trim()) {
        qb.andWhere('coa.accountCode ILIKE :colSearch', { colSearch: `%${search.trim()}%` });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'accountName' || column === 'account_name') {
      qb.select('DISTINCT coa.accountName', 'value');
      qb.andWhere("coa.accountName IS NOT NULL AND coa.accountName != ''");
      if (search && search.trim()) {
        qb.andWhere('coa.accountName ILIKE :colSearch', { colSearch: `%${search.trim()}%` });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'parentAccount' || column === 'parentId' || column === 'parent_id') {
      qb.select('DISTINCT parent.accountCode', 'value');
      qb.addSelect('parent.accountName', 'label');
      qb.andWhere('parent.id IS NOT NULL');
      if (search && search.trim()) {
        qb.andWhere(
          '(parent.accountCode ILIKE :colSearch OR parent.accountName ILIKE :colSearch)',
          { colSearch: `%${search.trim()}%` },
        );
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'accountType' || column === 'account_type') {
      qb.select('DISTINCT coa.accountType', 'value');
      qb.andWhere('coa.accountType IS NOT NULL');
      if (search && search.trim()) {
        qb.andWhere('coa.accountType ILIKE :colSearch', { colSearch: `%${search.trim()}%` });
      }
      qb.orderBy('value', 'ASC');
    } else {
      return { items: [], total: 0, page: 1, pageSize, totalPages: 1 };
    }

    const raw = await qb.getRawMany();
    const total = raw.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const paged = raw.slice((page - 1) * pageSize, page * pageSize);

    let items: { label: string; value: string }[] = [];
    if (column === 'parentAccount' || column === 'parentId') {
      items = paged.map((r) => ({
        value: String(r.value),
        label: r.label ? `${r.value} — ${r.label}` : String(r.value),
      }));
    } else {
      items = paged.map((r) => ({
        value: String(r.value),
        label: String(r.value),
      }));
    }

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getChartOfAccountById(id: string) {
    const account = await this.chartOfAccountRepo
      .createQueryBuilder('coa')
      .leftJoinAndSelect('coa.parent', 'parent')
      .where('coa.id = :id', { id })
      .andWhere('coa.isDeleted = false')
      .getOne();

    if (!account) {
      throw new NotFoundException(`Tài khoản kế toán không tồn tại (ID: ${id})`);
    }

    return account;
  }

  async createChartOfAccount(dto: any) {
    const code = (dto.account_code || dto.accountCode)?.trim();
    if (!code) {
      throw new BadRequestException('Mã tài khoản là bắt buộc');
    }
    const name = (dto.account_name || dto.accountName)?.trim();
    if (!name) {
      throw new BadRequestException('Tên tài khoản là bắt buộc');
    }

    const existing = await this.chartOfAccountRepo.findOne({
      where: { accountCode: code, isDeleted: false },
    });
    if (existing) {
      throw new BadRequestException(`Mã tài khoản "${code}" đã tồn tại trên hệ thống`);
    }

    const account = this.chartOfAccountRepo.create({
      accountCode: code,
      accountName: name,
      accountType: (dto.account_type || dto.accountType || 'ASSET').toUpperCase(),
      parentId: dto.parent_account_id ?? dto.parentId ?? null,
      isActive: dto.is_active ?? dto.isActive ?? true,
    });
    return this.chartOfAccountRepo.save(account);
  }

  async updateChartOfAccount(id: string, dto: any) {
    const account = await this.chartOfAccountRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!account) {
      throw new NotFoundException('Tài khoản kế toán không tồn tại');
    }

    if (dto.account_code || dto.accountCode) {
      const newCode = (dto.account_code || dto.accountCode).trim();
      if (newCode !== account.accountCode) {
        const existing = await this.chartOfAccountRepo.findOne({
          where: { accountCode: newCode, isDeleted: false },
        });
        if (existing && existing.id !== id) {
          throw new BadRequestException(`Mã tài khoản "${newCode}" đã tồn tại`);
        }
        account.accountCode = newCode;
      }
    }
    if (dto.account_name || dto.accountName) {
      account.accountName = (dto.account_name || dto.accountName).trim();
    }
    if (dto.account_type || dto.accountType) {
      account.accountType = (dto.account_type || dto.accountType).toUpperCase();
    }
    if (dto.parent_account_id !== undefined || dto.parentId !== undefined) {
      const newParentId =
        dto.parent_account_id !== undefined
          ? dto.parent_account_id
          : dto.parentId;
      if (newParentId === id) {
        throw new BadRequestException(
          'Tài khoản không thể tự làm tài khoản mẹ của chính mình',
        );
      }
      account.parentId = newParentId || null;
    }
    if (dto.is_active !== undefined || dto.isActive !== undefined) {
      account.isActive =
        dto.is_active !== undefined ? dto.is_active : dto.isActive;
    }
    return this.chartOfAccountRepo.save(account);
  }

  async deleteChartOfAccount(id: string) {
    const account = await this.chartOfAccountRepo.findOne({
      where: { id, isDeleted: false },
    });
    if (!account) {
      throw new NotFoundException('Tài khoản kế toán không tồn tại');
    }
    return this.chartOfAccountRepo.update(id, { isDeleted: true });
  }
}
