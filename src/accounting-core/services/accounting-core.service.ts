import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ErpChartOfAccount } from '../entities/erp_chart_of_account.entity';
import { ErpJournalEntry } from '../entities/erp_journal_entry.entity';
import { ErpJournalEntryLine } from '../entities/erp_journal_entry_line.entity';
import {
  applyMultiKeywordFilter,
  applyMultiKeywordMultiFieldFilter,
} from '../../common/utils/query-builder.util';

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
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));

    const qb = this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoinAndSelect('je.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
      .leftJoinAndSelect('je.branch', 'branch')
      .where('je.isDeleted = :isDeleted', { isDeleted: false });

    const branchId = query.branchId || query.branch_id;
    if (branchId) {
      qb.andWhere('je.branchId = :branchId', { branchId });
    }

    const startDate = query.startDate || query.date_from || query.dateFrom;
    if (startDate) {
      qb.andWhere('je.date >= :startDate', { startDate });
    }

    const endDate = query.endDate || query.date_to || query.dateTo;
    if (endDate) {
      const eDate =
        String(endDate).length === 10 ? `${endDate} 23:59:59.999` : endDate;
      qb.andWhere('je.date <= :endDate', { endDate: eDate });
    }

    const docDateFrom =
      query.doc_date_from || query.document_date_from || query.documentDateFrom;
    if (docDateFrom) {
      qb.andWhere('je.documentDate >= :docDateFrom', { docDateFrom });
    }

    const docDateTo =
      query.doc_date_to || query.document_date_to || query.documentDateTo;
    if (docDateTo) {
      qb.andWhere('je.documentDate <= :docDateTo', { docDateTo });
    }

    const sourceType = query.source_type || query.sourceType;
    if (sourceType && sourceType !== 'ALL') {
      if (sourceType === 'CASHFLOW') {
        qb.andWhere('je.sourceType IN (:...cfTypes)', {
          cfTypes: ['BANK', 'CASH'],
        });
      } else if (sourceType === 'OTHER') {
        qb.andWhere(
          '(je.sourceType IS NULL OR je.sourceType NOT IN (:...stdTypes))',
          { stdTypes: ['BANK', 'CASH', 'INVOICE'] },
        );
      } else {
        qb.andWhere('je.sourceType = :sourceType', { sourceType });
      }
    }

    if (query.accountId) {
      qb.andWhere('lines.accountId = :accountId', {
        accountId: query.accountId,
      });
    }

    // Global keyword search
    if (query.search && String(query.search).trim()) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        [
          'je.entryNo',
          'je.description',
          'je.subjectName',
          'je.reference',
          'branch.name',
          'account.accountCode',
          'lines.description',
        ],
        String(query.search).trim(),
        'je_search',
      );
    }

    // Column-specific searches
    let colSearch: Record<string, string> = {};
    if (query.column_search) {
      try {
        colSearch =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;
      } catch (e) {}
    } else if (query.columnSearch) {
      try {
        colSearch =
          typeof query.columnSearch === 'string'
            ? JSON.parse(query.columnSearch)
            : query.columnSearch;
      } catch (e) {}
    }

    for (const [colKey, rawVal] of Object.entries(colSearch)) {
      const val = typeof rawVal === 'string' ? rawVal.trim() : '';
      if (!val) continue;

      if (
        colKey === '_entryNo' ||
        colKey === 'entryNo' ||
        colKey === 'entry_no'
      ) {
        applyMultiKeywordFilter(qb, 'je.entryNo', val, 'cs_entryNo');
      } else if (colKey === '_branch' || colKey === 'branch') {
        applyMultiKeywordFilter(qb, 'branch.name', val, 'cs_branch');
      } else if (
        colKey === '_subjectName' ||
        colKey === 'subjectName' ||
        colKey === 'subject_name'
      ) {
        applyMultiKeywordFilter(qb, 'je.subjectName', val, 'cs_subject');
      } else if (colKey === 'description' || colKey === '_description') {
        applyMultiKeywordMultiFieldFilter(
          qb,
          ['je.description', 'lines.description'],
          val,
          'cs_desc',
        );
      } else if (colKey === '_reference' || colKey === 'reference') {
        applyMultiKeywordFilter(qb, 'je.reference', val, 'cs_ref');
      } else if (
        colKey === '_account' ||
        colKey === 'account' ||
        colKey === 'accountCode' ||
        colKey === '_opposingAccount' ||
        colKey === 'opposingAccount'
      ) {
        applyMultiKeywordFilter(qb, 'account.accountCode', val, 'cs_account');
      } else if (colKey === 'debit') {
        const num = Number(val.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) {
          qb.andWhere('lines.debit = :csDebit', { csDebit: num });
        }
      } else if (colKey === 'credit') {
        const num = Number(val.replace(/[^\d.-]/g, ''));
        if (!isNaN(num)) {
          qb.andWhere('lines.credit = :csCredit', { csCredit: num });
        }
      }
    }

    // Column checkbox filters (multi-select)
    let colFilters: Record<string, string[]> = {};
    if (query.column_filters) {
      try {
        colFilters =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;
      } catch (e) {}
    } else if (query.columnFilters) {
      try {
        colFilters =
          typeof query.columnFilters === 'string'
            ? JSON.parse(query.columnFilters)
            : query.columnFilters;
      } catch (e) {}
    }

    for (const [colKey, rawVals] of Object.entries(colFilters)) {
      const vals = Array.isArray(rawVals)
        ? rawVals.map((v) => String(v).trim()).filter(Boolean)
        : typeof rawVals === 'string'
          ? String(rawVals)
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
      if (vals.length === 0) continue;

      if (vals[0] === '__ALL_MATCHING__') {
        const searchKeyword = vals[1] || '';
        if (
          colKey === '_entryNo' ||
          colKey === 'entryNo' ||
          colKey === 'entry_no'
        ) {
          applyMultiKeywordFilter(
            qb,
            'je.entryNo',
            searchKeyword,
            'f_all_entryNo',
          );
        } else if (
          colKey === '_branch' ||
          colKey === 'branch' ||
          colKey === 'branchId'
        ) {
          applyMultiKeywordFilter(
            qb,
            'branch.name',
            searchKeyword,
            'f_all_branch',
          );
        } else if (
          colKey === '_subjectName' ||
          colKey === 'subjectName' ||
          colKey === 'subject_name'
        ) {
          applyMultiKeywordFilter(
            qb,
            'je.subjectName',
            searchKeyword,
            'f_all_subject',
          );
        } else if (colKey === 'description' || colKey === '_description') {
          applyMultiKeywordMultiFieldFilter(
            qb,
            ['je.description', 'lines.description'],
            searchKeyword,
            'f_all_desc',
          );
        } else if (colKey === '_reference' || colKey === 'reference') {
          applyMultiKeywordFilter(
            qb,
            'je.reference',
            searchKeyword,
            'f_all_ref',
          );
        } else if (
          colKey === '_account' ||
          colKey === 'account' ||
          colKey === 'accountCode' ||
          colKey === '_opposingAccount' ||
          colKey === 'opposingAccount'
        ) {
          applyMultiKeywordFilter(
            qb,
            'account.accountCode',
            searchKeyword,
            'f_all_account',
          );
        }
        continue;
      }

      if (
        colKey === '_entryNo' ||
        colKey === 'entryNo' ||
        colKey === 'entry_no'
      ) {
        qb.andWhere('je.entryNo IN (:...fEntryNos)', { fEntryNos: vals });
      } else if (
        colKey === '_branch' ||
        colKey === 'branch' ||
        colKey === 'branchId'
      ) {
        qb.andWhere(
          '(je.branchId IN (:...fBranches) OR branch.name IN (:...fBranches))',
          { fBranches: vals },
        );
      } else if (
        colKey === '_subjectName' ||
        colKey === 'subjectName' ||
        colKey === 'subject_name'
      ) {
        const hasBlank = vals.includes('__BLANK__') || vals.includes('(Trống)');
        const nonBlank = vals.filter(
          (v) => v !== '__BLANK__' && v !== '(Trống)',
        );
        if (hasBlank && nonBlank.length > 0) {
          qb.andWhere(
            "(je.subjectName IS NULL OR je.subjectName = '' OR je.subjectName IN (:...fSubjects))",
            { fSubjects: nonBlank },
          );
        } else if (hasBlank) {
          qb.andWhere("(je.subjectName IS NULL OR je.subjectName = '')");
        } else if (nonBlank.length > 0) {
          qb.andWhere('je.subjectName IN (:...fSubjects)', {
            fSubjects: nonBlank,
          });
        }
      } else if (colKey === '_status' || colKey === 'status') {
        qb.andWhere('je.status IN (:...fStatus)', { fStatus: vals });
      } else if (
        colKey === '_sourceType' ||
        colKey === 'sourceType' ||
        colKey === 'source_type'
      ) {
        qb.andWhere('je.sourceType IN (:...fSourceTypes)', {
          fSourceTypes: vals,
        });
      } else if (colKey === '_reference' || colKey === 'reference') {
        const hasBlank = vals.includes('__BLANK__') || vals.includes('(Trống)');
        const nonBlank = vals.filter(
          (v) => v !== '__BLANK__' && v !== '(Trống)',
        );
        if (hasBlank && nonBlank.length > 0) {
          qb.andWhere(
            "(je.reference IS NULL OR je.reference = '' OR je.reference IN (:...fRefs))",
            { fRefs: nonBlank },
          );
        } else if (hasBlank) {
          qb.andWhere("(je.reference IS NULL OR je.reference = '')");
        } else if (nonBlank.length > 0) {
          qb.andWhere('je.reference IN (:...fRefs)', { fRefs: nonBlank });
        }
      } else if (
        colKey === '_account' ||
        colKey === 'account' ||
        colKey === 'accountCode' ||
        colKey === '_opposingAccount' ||
        colKey === 'opposingAccount'
      ) {
        const hasBlank = vals.includes('__BLANK__') || vals.includes('(Trống)');
        const nonBlank = vals.filter(
          (v) => v !== '__BLANK__' && v !== '(Trống)',
        );
        if (hasBlank && nonBlank.length > 0) {
          qb.andWhere(
            "(account.accountCode IS NULL OR account.accountCode = '' OR account.accountCode IN (:...fAccounts))",
            { fAccounts: nonBlank },
          );
        } else if (hasBlank) {
          qb.andWhere(
            "(account.accountCode IS NULL OR account.accountCode = '')",
          );
        } else if (nonBlank.length > 0) {
          qb.andWhere('account.accountCode IN (:...fAccounts)', {
            fAccounts: nonBlank,
          });
        }
      } else if (colKey === 'description' || colKey === '_description') {
        qb.andWhere(
          '(je.description IN (:...fDescs) OR lines.description IN (:...fDescs))',
          { fDescs: vals },
        );
      } else if (colKey === 'debit') {
        const numVals = vals.map(Number).filter((n) => !isNaN(n));
        if (numVals.length > 0) {
          qb.andWhere('lines.debit IN (:...fDebits)', { fDebits: numVals });
        }
      } else if (colKey === 'credit') {
        const numVals = vals.map(Number).filter((n) => !isNaN(n));
        if (numVals.length > 0) {
          qb.andWhere('lines.credit IN (:...fCredits)', { fCredits: numVals });
        }
      }
    }

    // Dynamic Multi-column sorting
    const sortParam = query.sort || query.sorts;
    if (sortParam) {
      const sortList = Array.isArray(sortParam)
        ? sortParam
        : typeof sortParam === 'string'
          ? sortParam
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      let hasOrder = false;
      for (const sortField of sortList) {
        const isDesc = sortField.startsWith('-');
        const rawField = isDesc ? sortField.substring(1) : sortField;
        const validFields: Record<string, string> = {
          date: 'je.date',
          _date: 'je.date',
          documentDate: 'je.documentDate',
          _documentDate: 'je.documentDate',
          document_date: 'je.documentDate',
          entryNo: 'je.entryNo',
          _entryNo: 'je.entryNo',
          entry_no: 'je.entryNo',
          branch: 'branch.name',
          _branch: 'branch.name',
          subjectName: 'je.subjectName',
          _subjectName: 'je.subjectName',
          subject_name: 'je.subjectName',
          description: 'je.description',
          _description: 'je.description',
          reference: 'je.reference',
          _reference: 'je.reference',
          status: 'je.status',
          _status: 'je.status',
          sourceType: 'je.sourceType',
          _sourceType: 'je.sourceType',
          source_type: 'je.sourceType',
          debit: 'lines.debit',
          credit: 'lines.credit',
          account: 'account.accountCode',
          _account: 'account.accountCode',
          accountCode: 'account.accountCode',
          createdAt: 'je.createdAt',
          created_at: 'je.createdAt',
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
        qb.orderBy('je.date', 'DESC').addOrderBy('je.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('je.date', 'DESC').addOrderBy('je.createdAt', 'DESC');
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

  async getJournalEntriesColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    branchId?: string,
  ) {
    const qb = this.journalEntryRepo
      .createQueryBuilder('je')
      .leftJoin('je.lines', 'lines')
      .leftJoin('lines.account', 'account')
      .leftJoin('je.branch', 'branch')
      .where('je.isDeleted = :isDeleted', { isDeleted: false });

    if (branchId) {
      qb.andWhere('je.branchId = :branchId', { branchId });
    }

    // Cascading filters
    if (filtersStr) {
      try {
        const filters = JSON.parse(filtersStr) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(filters)) {
          if (!vals || vals.length === 0) continue;
          if (col === column) continue;

          if (col === '_entryNo' || col === 'entryNo' || col === 'entry_no') {
            qb.andWhere('je.entryNo IN (:...cfEntryNos)', {
              cfEntryNos: vals,
            });
          } else if (
            col === '_branch' ||
            col === 'branch' ||
            col === 'branchId'
          ) {
            qb.andWhere(
              '(je.branchId IN (:...cfBranches) OR branch.name IN (:...cfBranches))',
              { cfBranches: vals },
            );
          } else if (
            col === '_subjectName' ||
            col === 'subjectName' ||
            col === 'subject_name'
          ) {
            const hasBlank =
              vals.includes('__BLANK__') || vals.includes('(Trống)');
            const nonBlank = vals.filter(
              (v) => v !== '__BLANK__' && v !== '(Trống)',
            );
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(je.subjectName IS NULL OR je.subjectName = '' OR je.subjectName IN (:...cfSubjects))",
                { cfSubjects: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere("(je.subjectName IS NULL OR je.subjectName = '')");
            } else if (nonBlank.length > 0) {
              qb.andWhere('je.subjectName IN (:...cfSubjects)', {
                cfSubjects: nonBlank,
              });
            }
          } else if (col === '_status' || col === 'status') {
            qb.andWhere('je.status IN (:...cfStatus)', { cfStatus: vals });
          } else if (
            col === '_sourceType' ||
            col === 'sourceType' ||
            col === 'source_type'
          ) {
            qb.andWhere('je.sourceType IN (:...cfSourceTypes)', {
              cfSourceTypes: vals,
            });
          } else if (col === '_reference' || col === 'reference') {
            const hasBlank =
              vals.includes('__BLANK__') || vals.includes('(Trống)');
            const nonBlank = vals.filter(
              (v) => v !== '__BLANK__' && v !== '(Trống)',
            );
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(je.reference IS NULL OR je.reference = '' OR je.reference IN (:...cfRefs))",
                { cfRefs: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere("(je.reference IS NULL OR je.reference = '')");
            } else if (nonBlank.length > 0) {
              qb.andWhere('je.reference IN (:...cfRefs)', {
                cfRefs: nonBlank,
              });
            }
          } else if (
            col === '_account' ||
            col === 'account' ||
            col === 'accountCode' ||
            col === '_opposingAccount' ||
            col === 'opposingAccount'
          ) {
            const hasBlank =
              vals.includes('__BLANK__') || vals.includes('(Trống)');
            const nonBlank = vals.filter(
              (v) => v !== '__BLANK__' && v !== '(Trống)',
            );
            if (hasBlank && nonBlank.length > 0) {
              qb.andWhere(
                "(account.accountCode IS NULL OR account.accountCode = '' OR account.accountCode IN (:...cfAccounts))",
                { cfAccounts: nonBlank },
              );
            } else if (hasBlank) {
              qb.andWhere(
                "(account.accountCode IS NULL OR account.accountCode = '')",
              );
            } else if (nonBlank.length > 0) {
              qb.andWhere('account.accountCode IN (:...cfAccounts)', {
                cfAccounts: nonBlank,
              });
            }
          }
        }
      } catch (e) {}
    }

    if (
      column === '_entryNo' ||
      column === 'entryNo' ||
      column === 'entry_no'
    ) {
      qb.select('DISTINCT je.entryNo', 'value');
      qb.andWhere("je.entryNo IS NOT NULL AND je.entryNo != ''");
      if (search && search.trim()) {
        qb.andWhere('je.entryNo ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === '_branch' || column === 'branch') {
      qb.select('DISTINCT branch.name', 'value');
      qb.andWhere("branch.name IS NOT NULL AND branch.name != ''");
      if (search && search.trim()) {
        qb.andWhere('branch.name ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (
      column === '_subjectName' ||
      column === 'subjectName' ||
      column === 'subject_name'
    ) {
      qb.select('DISTINCT je.subjectName', 'value');
      qb.andWhere("je.subjectName IS NOT NULL AND je.subjectName != ''");
      if (search && search.trim()) {
        qb.andWhere('je.subjectName ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (
      column === '_account' ||
      column === 'account' ||
      column === 'accountCode' ||
      column === '_opposingAccount' ||
      column === 'opposingAccount'
    ) {
      qb.select('DISTINCT account.accountCode', 'value');
      qb.andWhere(
        "account.accountCode IS NOT NULL AND account.accountCode != ''",
      );
      if (search && search.trim()) {
        qb.andWhere('account.accountCode ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === '_status' || column === 'status') {
      qb.select('DISTINCT je.status', 'value');
      qb.andWhere("je.status IS NOT NULL AND je.status != ''");
      if (search && search.trim()) {
        qb.andWhere('je.status ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (
      column === '_sourceType' ||
      column === 'sourceType' ||
      column === 'source_type'
    ) {
      qb.select('DISTINCT je.sourceType', 'value');
      qb.andWhere("je.sourceType IS NOT NULL AND je.sourceType != ''");
      if (search && search.trim()) {
        qb.andWhere('je.sourceType ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === '_reference' || column === 'reference') {
      qb.select('DISTINCT je.reference', 'value');
      qb.andWhere("je.reference IS NOT NULL AND je.reference != ''");
      if (search && search.trim()) {
        qb.andWhere('je.reference ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'description' || column === '_description') {
      qb.select(
        'DISTINCT COALESCE(lines.description, je.description)',
        'value',
      );
      qb.andWhere(
        "COALESCE(lines.description, je.description) IS NOT NULL AND COALESCE(lines.description, je.description) != ''",
      );
      if (search && search.trim()) {
        qb.andWhere(
          '(je.description ILIKE :colSearch OR lines.description ILIKE :colSearch)',
          {
            colSearch: `%${search.trim()}%`,
          },
        );
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'debit') {
      qb.select('DISTINCT lines.debit', 'value');
      qb.andWhere('lines.debit > 0');
      qb.orderBy('value', 'ASC');
    } else if (column === 'credit') {
      qb.select('DISTINCT lines.credit', 'value');
      qb.andWhere('lines.credit > 0');
      qb.orderBy('value', 'ASC');
    } else {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const rawRows = await qb.getRawMany();
    const total = rawRows.length;
    const startIdx = (page - 1) * pageSize;
    const paginatedRows = rawRows.slice(startIdx, startIdx + pageSize);

    return {
      items: paginatedRows.map((r) => ({
        label: String(r.value),
        value: String(r.value),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
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
          ? accountCode
              .split(',')
              .map((c) => c.trim())
              .filter(Boolean)
          : [];
      if (codes.length > 0) {
        qb.andWhere('coa.accountCode IN (:...accountCodes)', {
          accountCodes: codes,
        });
      }
    }

    const accountName = query.accountName || query.account_name;
    if (accountName) {
      const names = Array.isArray(accountName)
        ? accountName
        : typeof accountName === 'string'
          ? accountName
              .split(',')
              .map((n) => n.trim())
              .filter(Boolean)
          : [];
      if (names.length > 0) {
        qb.andWhere('coa.accountName IN (:...accountNames)', {
          accountNames: names,
        });
      }
    }

    const parentAccount =
      query.parentAccount || query.parentId || query.parent_id;
    if (parentAccount) {
      const parents = Array.isArray(parentAccount)
        ? parentAccount
        : typeof parentAccount === 'string'
          ? parentAccount
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
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
        const types = accountType
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
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
      const activeVal =
        isActive === true ||
        isActive === 'true' ||
        isActive === 1 ||
        isActive === '1';
      qb.andWhere('coa.isActive = :isActive', { isActive: activeVal });
    }

    // Dynamic sorting
    const sortParam = query.sort || query.sorts;
    if (sortParam) {
      const sortList = Array.isArray(sortParam)
        ? sortParam
        : typeof sortParam === 'string'
          ? sortParam
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
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
            qb.andWhere('coa.accountType IN (:...fAccountTypes)', {
              fAccountTypes: vals,
            });
          } else if (col === 'isActive' || col === 'is_active') {
            const hasTrue = vals.includes('true');
            const hasFalse = vals.includes('false');
            if (hasTrue && !hasFalse)
              qb.andWhere('coa.isActive = :fActive', { fActive: true });
            else if (hasFalse && !hasTrue)
              qb.andWhere('coa.isActive = :fActive', { fActive: false });
          } else if (col === 'accountCode' || col === 'account_code') {
            qb.andWhere('coa.accountCode IN (:...fAccountCodes)', {
              fAccountCodes: vals,
            });
          } else if (col === 'accountName' || col === 'account_name') {
            qb.andWhere('coa.accountName IN (:...fAccountNames)', {
              fAccountNames: vals,
            });
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
        qb.andWhere('coa.accountCode ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (column === 'accountName' || column === 'account_name') {
      qb.select('DISTINCT coa.accountName', 'value');
      qb.andWhere("coa.accountName IS NOT NULL AND coa.accountName != ''");
      if (search && search.trim()) {
        qb.andWhere('coa.accountName ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
      }
      qb.orderBy('value', 'ASC');
    } else if (
      column === 'parentAccount' ||
      column === 'parentId' ||
      column === 'parent_id'
    ) {
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
        qb.andWhere('coa.accountType ILIKE :colSearch', {
          colSearch: `%${search.trim()}%`,
        });
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
      throw new NotFoundException(
        `Tài khoản kế toán không tồn tại (ID: ${id})`,
      );
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
      throw new BadRequestException(
        `Mã tài khoản "${code}" đã tồn tại trên hệ thống`,
      );
    }

    const account = this.chartOfAccountRepo.create({
      accountCode: code,
      accountName: name,
      accountType: (
        dto.account_type ||
        dto.accountType ||
        'ASSET'
      ).toUpperCase(),
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
