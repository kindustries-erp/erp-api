import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository, Not, Brackets } from 'typeorm';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import {
  ApplyRecurringOperatingExpenseDto,
  ListOperatingExpensesQueryDto,
} from './dto/operating-expense-query.dto';
import { applyMultiKeywordFilter } from '../common/utils/query-builder.util';

@Injectable()
export class OperatingExpensesCoreService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ErpOperatingExpense)
    private readonly repository: Repository<ErpOperatingExpense>,
  ) {}

  private async generateExpenseNo(manager: any, orderDate?: string) {
    const baseDate = orderDate ? new Date(orderDate) : new Date();
    const year = baseDate.getUTCFullYear();
    const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
    const prefix = `EXP-${year}${month}-`;
    const latest = await manager
      .getRepository(ErpOperatingExpense)
      .createQueryBuilder('exp')
      .where('exp.expenseNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('exp.expenseNo', 'DESC')
      .getOne();
    const latestSeq = latest?.expenseNo?.slice(prefix.length) ?? '000';
    const nextSeq = String(Number(latestSeq || '0') + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  async create(dto: CreateOperatingExpenseDto, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ErpOperatingExpense);
      const docDate = dto.document_date || dto.documentDate;
      const baseDate = docDate ? new Date(docDate) : new Date();

      const periodYear =
        dto.periodYear ??
        dto.period_year ??
        (isNaN(baseDate.getFullYear())
          ? new Date().getFullYear()
          : baseDate.getFullYear());
      const periodMonth =
        dto.periodMonth ??
        dto.period_month ??
        (isNaN(baseDate.getMonth())
          ? new Date().getMonth() + 1
          : baseDate.getMonth() + 1);

      const categoryKey =
        dto.categoryKey ||
        dto.category_key ||
        dto.expenseCategory ||
        dto.expense_category ||
        'KHAC';
      const costGroup = dto.costGroup || dto.cost_group || 'OPEX';
      const totalAmount =
        dto.totalAmount ?? dto.total_amount ?? dto.amount ?? 0;
      const recurrenceType =
        dto.recurrenceType || dto.recurrence_type || 'ONE_TIME';
      const recurrenceUntilYear =
        dto.recurrenceUntilYear ?? dto.recurrence_until_year ?? null;
      const recurrenceUntilMonth =
        dto.recurrenceUntilMonth ?? dto.recurrence_until_month ?? null;

      const expenseNo =
        dto.expense_no?.trim() ||
        dto.expenseNo?.trim() ||
        (await this.generateExpenseNo(manager, docDate));

      const payload: DeepPartial<ErpOperatingExpense> = {
        expenseNo,
        branchId: dto.branch_id ?? dto.branchId ?? null,
        supplierId: dto.supplier_id ?? dto.supplierId ?? null,
        supplierNameSnapshot:
          dto.supplier_name_snapshot ?? dto.supplierNameSnapshot ?? null,
        expenseCategory:
          dto.expense_category ?? dto.expenseCategory ?? categoryKey,
        categoryKey,
        costGroup,
        title: dto.title ?? null,
        periodYear: Number(periodYear),
        periodMonth: Number(periodMonth),
        documentDate: docDate ?? null,
        dueDate: dto.due_date ?? dto.dueDate ?? null,
        invoiceStatus:
          dto.invoice_status ?? dto.invoiceStatus ?? 'NOT_REQUIRED',
        status: dto.status ?? 'CONFIRMED',
        paymentStatus: dto.payment_status ?? dto.paymentStatus ?? 'UNPAID',
        totalAmount: Number(totalAmount),
        recurrenceType,
        recurrenceInterval:
          dto.recurrence_interval ?? dto.recurrenceInterval ?? 1,
        recurrenceStartDate:
          dto.recurrence_start_date ?? dto.recurrenceStartDate ?? null,
        recurrenceEndDate:
          dto.recurrence_end_date ?? dto.recurrenceEndDate ?? null,
        recurrenceUntilYear: recurrenceUntilYear
          ? Number(recurrenceUntilYear)
          : null,
        recurrenceUntilMonth: recurrenceUntilMonth
          ? Number(recurrenceUntilMonth)
          : null,
        recurrenceAnchorId:
          dto.recurrence_anchor_id ?? dto.recurrenceAnchorId ?? null,
        nextDueDate: dto.next_due_date ?? dto.nextDueDate ?? null,
        autoGenerateNext:
          dto.auto_generate_next ?? dto.autoGenerateNext ?? false,
        parentRecurringId:
          dto.parent_recurring_id ?? dto.parentRecurringId ?? null,
        notes: dto.notes ?? dto.note ?? null,
        createdBy: userId ?? null,
      };

      const saved = await repo.save(payload);

      // Nếu tạo chuỗi định kỳ hàng tháng, tự động generate các tháng tiếp theo
      if (
        (saved.recurrenceType?.toUpperCase() === 'MONTHLY' ||
          saved.recurrenceType?.toLowerCase() === 'monthly') &&
        saved.recurrenceUntilYear &&
        saved.recurrenceUntilMonth
      ) {
        await this.generateFutureRecurringMonths(
          manager,
          saved,
          Number(saved.recurrenceUntilYear),
          Number(saved.recurrenceUntilMonth),
          userId,
        );
      }

      const formatted = {
        ...saved,
        totalAmount: Number(saved.totalAmount) || 0,
        amount: Number(saved.totalAmount) || 0,
        period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
      };

      return { message: 'Tạo khoản chi thành công', data: formatted };
    });
  }

  private async generateFutureRecurringMonths(
    manager: any,
    anchor: ErpOperatingExpense,
    untilYear: number,
    untilMonth: number,
    userId?: string,
  ) {
    const repo = manager.getRepository(ErpOperatingExpense);
    const anchorId = anchor.recurrenceAnchorId || anchor.id;

    let curY = Number(anchor.periodYear);
    let curM = Number(anchor.periodMonth) + 1;
    if (curM > 12) {
      curM = 1;
      curY += 1;
    }

    const periods: Array<{ year: number; month: number }> = [];
    while (curY < untilYear || (curY === untilYear && curM <= untilMonth)) {
      periods.push({ year: curY, month: curM });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    for (const p of periods) {
      const existing = await repo.findOne({
        where: {
          periodYear: p.year,
          periodMonth: p.month,
          recurrenceAnchorId: anchorId,
          isDeleted: false,
        },
      });

      if (existing) {
        existing.totalAmount = anchor.totalAmount;
        existing.title = anchor.title;
        existing.categoryKey = anchor.categoryKey;
        existing.expenseCategory = anchor.expenseCategory;
        existing.costGroup = anchor.costGroup;
        existing.notes = anchor.notes;
        existing.recurrenceType = anchor.recurrenceType;
        existing.recurrenceUntilYear = anchor.recurrenceUntilYear;
        existing.recurrenceUntilMonth = anchor.recurrenceUntilMonth;
        await repo.save(existing);
      } else {
        const expenseNo = await this.generateExpenseNo(
          manager,
          `${p.year}-${String(p.month).padStart(2, '0')}-01`,
        );
        const newItem = repo.create({
          expenseNo,
          branchId: anchor.branchId,
          supplierId: anchor.supplierId,
          supplierNameSnapshot: anchor.supplierNameSnapshot,
          categoryKey: anchor.categoryKey,
          expenseCategory: anchor.expenseCategory,
          costGroup: anchor.costGroup,
          title: anchor.title,
          periodYear: p.year,
          periodMonth: p.month,
          documentDate: `${p.year}-${String(p.month).padStart(2, '0')}-01`,
          status: anchor.status,
          paymentStatus: 'UNPAID',
          totalAmount: anchor.totalAmount,
          recurrenceType: anchor.recurrenceType,
          recurrenceInterval: 1,
          recurrenceUntilYear: anchor.recurrenceUntilYear,
          recurrenceUntilMonth: anchor.recurrenceUntilMonth,
          recurrenceAnchorId: anchorId,
          notes: anchor.notes,
          createdBy: userId || null,
        });
        await repo.save(newItem);
      }
    }
  }

  private mapColumnToSqlField(column: string): string | null {
    const map: Record<string, string> = {
      expenseNo: 'exp.expenseNo',
      expense_no: 'exp.expenseNo',
      doc_no: 'exp.expenseNo',
      title: 'exp.title',
      expenseCategory: 'exp.expenseCategory',
      expense_category: 'exp.expenseCategory',
      categoryKey: 'exp.categoryKey',
      category_key: 'exp.categoryKey',
      costGroup: 'exp.costGroup',
      cost_group: 'exp.costGroup',
      periodYear: 'exp.periodYear',
      period_year: 'exp.periodYear',
      periodMonth: 'exp.periodMonth',
      period_month: 'exp.periodMonth',
      status: 'exp.status',
      paymentStatus: 'exp.paymentStatus',
      payment_status: 'exp.paymentStatus',
      invoiceStatus: 'exp.invoiceStatus',
      invoice_status: 'exp.invoiceStatus',
      recurrenceType: 'exp.recurrenceType',
      recurrence_type: 'exp.recurrenceType',
      recurrenceInterval: 'exp.recurrenceInterval',
      recurrence_interval: 'exp.recurrenceInterval',
      recurrenceUntilYear: 'exp.recurrenceUntilYear',
      recurrence_until_year: 'exp.recurrenceUntilYear',
      recurrenceUntilMonth: 'exp.recurrenceUntilMonth',
      recurrence_until_month: 'exp.recurrenceUntilMonth',
      recurrenceAnchorId: 'exp.recurrenceAnchorId',
      recurrence_anchor_id: 'exp.recurrenceAnchorId',
      supplierNameSnapshot: 'exp.supplierNameSnapshot',
      supplier_name_snapshot: 'exp.supplierNameSnapshot',
      notes: 'exp.notes',
      note: 'exp.notes',
      documentDate: 'exp.documentDate',
      document_date: 'exp.documentDate',
      nextDueDate: 'exp.nextDueDate',
      next_due_date: 'exp.nextDueDate',
      dueDate: 'exp.dueDate',
      due_date: 'exp.dueDate',
      totalAmount: 'exp.totalAmount',
      total_amount: 'exp.totalAmount',
      amount: 'exp.totalAmount',
      createdAt: 'exp.createdAt',
      created_at: 'exp.createdAt',
    };
    return map[column] || null;
  }

  async findAll(query: ListOperatingExpensesQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const pageSize = Math.max(Number(query.pageSize) || 20, 1);
    const qb = this.repository.createQueryBuilder('exp');

    qb.where('exp.isDeleted = false');

    const branchId = query.branch_id || query.branchId;
    if (branchId) {
      qb.andWhere('exp.branchId = :branchId', { branchId });
    }

    if (query.year) {
      qb.andWhere('exp.periodYear = :year', { year: Number(query.year) });
    }
    if (query.month) {
      qb.andWhere('exp.periodMonth = :month', { month: Number(query.month) });
    }

    const costGroup = query.cost_group || query.costGroup;
    if (costGroup && costGroup !== 'ALL') {
      qb.andWhere('exp.costGroup = :costGroup', { costGroup });
    }

    if (query.status) {
      qb.andWhere('exp.status = :status', { status: query.status });
    }

    const paymentStatus = query.payment_status || query.paymentStatus;
    if (paymentStatus) {
      qb.andWhere('exp.paymentStatus = :paymentStatus', { paymentStatus });
    }

    const recurrenceType = query.recurrence_type || query.recurrenceType;
    if (recurrenceType) {
      qb.andWhere('exp.recurrenceType = :recurrenceType', { recurrenceType });
    }

    if (query.search && query.search.trim()) {
      const searchVal = `%${query.search.trim()}%`;
      qb.andWhere(
        '(exp.expenseNo ILIKE :search OR exp.title ILIKE :search OR exp.categoryKey ILIKE :search OR exp.notes ILIKE :search)',
        { search: searchVal },
      );
    }

    // Column Search (exact "" or multi-keyword ;)
    if (query.column_search) {
      try {
        const colSearches: Record<string, string> =
          typeof query.column_search === 'string'
            ? JSON.parse(query.column_search)
            : query.column_search;

        Object.entries(colSearches).forEach(([colKey, searchVal], idx) => {
          if (searchVal && searchVal.trim()) {
            if (colKey === 'period') {
              qb.andWhere(
                `(LPAD(COALESCE(exp.periodMonth, 1)::text, 2, '0') || '/' || COALESCE(exp.periodYear, 2026)::text) ILIKE :pSearch_${idx}`,
                { [`pSearch_${idx}`]: `%${searchVal.trim()}%` },
              );
            } else if (colKey === 'recurrenceUntil') {
              qb.andWhere(
                `(LPAD(COALESCE(exp.recurrenceUntilMonth, 1)::text, 2, '0') || '/' || COALESCE(exp.recurrenceUntilYear, 2026)::text) ILIKE :ruSearch_${idx}`,
                { [`ruSearch_${idx}`]: `%${searchVal.trim()}%` },
              );
            } else {
              const sqlField = this.mapColumnToSqlField(colKey);
              if (sqlField) {
                applyMultiKeywordFilter(
                  qb,
                  `CAST(${sqlField} AS text)`,
                  searchVal.trim(),
                  `col_search_${idx}`,
                );
              }
            }
          }
        });
      } catch (e) {
        // ignore parse error
      }
    }

    // Column Filters
    if (query.column_filters) {
      try {
        const colFilters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;

        Object.entries(colFilters).forEach(([colKey, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
            // 1. Special Handling for Period Filter (MM/YYYY)
            if (colKey === 'period') {
              const periodConditions = values.map((p, pIdx) => {
                const [m, y] = p.split('/').map(Number);
                return `(exp.periodMonth = :pMonth_${idx}_${pIdx} AND exp.periodYear = :pYear_${idx}_${pIdx})`;
              });
              const periodParams = values.reduce(
                (acc, p, pIdx) => {
                  const [m, y] = p.split('/').map(Number);
                  acc[`pMonth_${idx}_${pIdx}`] = m;
                  acc[`pYear_${idx}_${pIdx}`] = y;
                  return acc;
                },
                {} as Record<string, number>,
              );
              if (periodConditions.length > 0) {
                qb.andWhere(`(${periodConditions.join(' OR ')})`, periodParams);
              }
              return;
            }

            // 2. Special Handling for Recurrence Until (MM/YYYY)
            if (colKey === 'recurrenceUntil') {
              const hasBlank = values.includes('__BLANK__');
              const cleanValues = values.filter((v) => v !== '__BLANK__');
              const untilConditions = cleanValues.map((p, uIdx) => {
                const [m, y] = p.split('/').map(Number);
                return `(exp.recurrenceUntilMonth = :ruMonth_${idx}_${uIdx} AND exp.recurrenceUntilYear = :ruYear_${idx}_${uIdx})`;
              });
              const untilParams = cleanValues.reduce(
                (acc, p, uIdx) => {
                  const [m, y] = p.split('/').map(Number);
                  acc[`ruMonth_${idx}_${uIdx}`] = m;
                  acc[`ruYear_${idx}_${uIdx}`] = y;
                  return acc;
                },
                {} as Record<string, number>,
              );

              if (hasBlank && untilConditions.length > 0) {
                qb.andWhere(
                  `(${untilConditions.join(' OR ')} OR exp.recurrenceUntilYear IS NULL OR exp.recurrenceUntilMonth IS NULL)`,
                  untilParams,
                );
              } else if (hasBlank) {
                qb.andWhere(
                  '(exp.recurrenceUntilYear IS NULL OR exp.recurrenceUntilMonth IS NULL)',
                );
              } else if (untilConditions.length > 0) {
                qb.andWhere(`(${untilConditions.join(' OR ')})`, untilParams);
              }
              return;
            }

            const sqlField = this.mapColumnToSqlField(colKey);
            if (sqlField) {
              if (values[0] === '__ALL_MATCHING__') {
                const searchStr = (values[1] || '').trim();
                if (searchStr) {
                  applyMultiKeywordFilter(
                    qb,
                    `CAST(${sqlField} AS text)`,
                    searchStr,
                    `col_flt_all_${idx}`,
                  );
                }
                return;
              }

              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `col_filter_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`CAST(${sqlField} AS text) IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else {
                qb.andWhere(`CAST(${sqlField} AS text) IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // ignore parse error
      }
    }

    // Date Range Filters (Period range or Document Date range)
    const dateFrom = query.date_from || query.dateFrom;
    const dateTo = query.date_to || query.dateTo;

    if (dateFrom) {
      if (dateFrom.length === 7) {
        // YYYY-MM
        const [y, m] = dateFrom.split('-').map(Number);
        qb.andWhere('(exp.periodYear * 100 + exp.periodMonth) >= :fromPeriod', {
          fromPeriod: y * 100 + m,
        });
      } else {
        qb.andWhere('exp.documentDate >= :dateFrom', { dateFrom });
      }
    }
    if (dateTo) {
      if (dateTo.length === 7) {
        // YYYY-MM
        const [y, m] = dateTo.split('-').map(Number);
        qb.andWhere('(exp.periodYear * 100 + exp.periodMonth) <= :toPeriod', {
          toPeriod: y * 100 + m,
        });
      } else {
        qb.andWhere('exp.documentDate <= :dateTo', { dateTo });
      }
    }

    // Calculate sum of total_amount before pagination
    const sumResult = await qb
      .clone()
      .orderBy()
      .select('COALESCE(SUM(exp.totalAmount), 0)', 'totalAmountSum')
      .getRawOne();
    const totalAmountSum = Number(sumResult?.totalAmountSum || 0);

    // Sorting
    let sortsArr: string[] = [];
    if (Array.isArray(query.sorts)) {
      sortsArr = query.sorts;
    } else if (typeof query.sorts === 'string' && query.sorts.trim()) {
      sortsArr = [query.sorts.trim()];
    } else if (Array.isArray(query['sorts[]'])) {
      sortsArr = query['sorts[]'];
    } else if (
      typeof query['sorts[]'] === 'string' &&
      query['sorts[]'].trim()
    ) {
      sortsArr = [query['sorts[]'].trim()];
    }

    if (sortsArr.length > 0) {
      sortsArr.forEach((s: string, idx: number) => {
        const isDesc = s.startsWith('-');
        const cleanKey = isDesc ? s.substring(1) : s;
        const dir = isDesc ? 'DESC' : 'ASC';

        if (cleanKey === 'period' || cleanKey === 'periodYear') {
          if (idx === 0) {
            qb.orderBy('exp.periodYear', dir).addOrderBy(
              'exp.periodMonth',
              dir,
            );
          } else {
            qb.addOrderBy('exp.periodYear', dir).addOrderBy(
              'exp.periodMonth',
              dir,
            );
          }
        } else if (
          cleanKey === 'recurrenceUntil' ||
          cleanKey === 'recurrenceUntilYear'
        ) {
          if (idx === 0) {
            qb.orderBy('exp.recurrenceUntilYear', dir).addOrderBy(
              'exp.recurrenceUntilMonth',
              dir,
            );
          } else {
            qb.addOrderBy('exp.recurrenceUntilYear', dir).addOrderBy(
              'exp.recurrenceUntilMonth',
              dir,
            );
          }
        } else {
          const sqlField = this.mapColumnToSqlField(cleanKey);
          if (sqlField) {
            if (idx === 0) {
              qb.orderBy(sqlField, dir);
            } else {
              qb.addOrderBy(sqlField, dir);
            }
          }
        }
      });
    } else {
      qb.orderBy('exp.periodYear', 'DESC')
        .addOrderBy('exp.periodMonth', 'DESC')
        .addOrderBy('exp.createdAt', 'DESC');
    }

    const [rawItems, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const data = rawItems.map((item) => {
      const pYear =
        item.periodYear ||
        (item.documentDate ? new Date(item.documentDate).getFullYear() : 2026);
      const pMonth =
        item.periodMonth ||
        (item.documentDate ? new Date(item.documentDate).getMonth() + 1 : 1);
      return {
        ...item,
        periodYear: pYear,
        periodMonth: pMonth,
        totalAmount: Number(item.totalAmount) || 0,
        amount: Number(item.totalAmount) || 0,
        period: `${String(pMonth).padStart(2, '0')}/${pYear}`,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      meta: {
        filter_count: total,
        totalAmountSum,
      },
    };
  }

  async getColumnOptions(
    column: string,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    branchId?: string,
  ) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safePageSize = Math.max(Number(pageSize) || 20, 1);

    const qb = this.repository.createQueryBuilder('exp');
    qb.where('exp.isDeleted = false');

    if (branchId) {
      qb.andWhere('exp.branchId = :branchId', { branchId });
    }

    let distinctField = 'exp.title';
    let fieldAlias = 'value';

    if (column === 'period') {
      distinctField = `LPAD(COALESCE(exp.period_month, 1)::text, 2, '0') || '/' || COALESCE(exp.period_year, 2026)::text`;
    } else if (column === 'recurrenceUntil') {
      distinctField = `LPAD(COALESCE(exp.recurrence_until_month, 1)::text, 2, '0') || '/' || COALESCE(exp.recurrence_until_year, 2026)::text`;
    } else if (column === 'categoryKey' || column === 'category_key') {
      distinctField = 'exp.category_key';
    } else if (column === 'costGroup' || column === 'cost_group') {
      distinctField = 'exp.cost_group';
    } else if (column === 'expenseCategory' || column === 'expense_category') {
      distinctField = 'exp.expense_category';
    } else if (column === 'recurrenceType' || column === 'recurrence_type') {
      distinctField = 'exp.recurrence_type';
    } else if (
      column === 'totalAmount' ||
      column === 'total_amount' ||
      column === 'amount'
    ) {
      distinctField = 'exp.total_amount::text';
    } else if (column === 'paymentStatus' || column === 'payment_status') {
      distinctField = 'exp.payment_status';
    } else if (column === 'status') {
      distinctField = 'exp.status';
    } else if (column === 'notes' || column === 'note') {
      distinctField = 'exp.notes';
    } else if (column === 'title') {
      distinctField = 'exp.title';
    } else {
      const sqlField = this.mapColumnToSqlField(column);
      if (!sqlField) {
        return {
          items: [],
          total: 0,
          page: safePage,
          pageSize: safePageSize,
          totalPages: 0,
        };
      }
      distinctField = `CAST(${sqlField} AS text)`;
    }

    // Cross-filtering
    if (filtersStr) {
      try {
        const filters: Record<string, string[]> =
          typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr;
        Object.entries(filters).forEach(([key, values], idx) => {
          if (key !== column && Array.isArray(values) && values.length > 0) {
            const sqlField = this.mapColumnToSqlField(key);
            if (sqlField) {
              const hasBlank = values.includes('__BLANK__');
              const nonBlankValues = values.filter((v) => v !== '__BLANK__');
              const pName = `c_opt_flt_${idx}`;

              if (hasBlank && nonBlankValues.length > 0) {
                qb.andWhere(
                  new Brackets((sqb) => {
                    sqb
                      .where(`CAST(${sqlField} AS text) IN (:...${pName})`, {
                        [pName]: nonBlankValues,
                      })
                      .orWhere(
                        `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                      );
                  }),
                );
              } else if (hasBlank) {
                qb.andWhere(
                  `(${sqlField} IS NULL OR CAST(${sqlField} AS text) = '')`,
                );
              } else {
                qb.andWhere(`CAST(${sqlField} AS text) IN (:...${pName})`, {
                  [pName]: nonBlankValues,
                });
              }
            }
          }
        });
      } catch (e) {
        // ignore parse error
      }
    }

    // Search within this column
    if (search && search.trim()) {
      qb.andWhere(`${distinctField} ILIKE :colSearch`, {
        colSearch: `%${search.trim()}%`,
      });
    }

    qb.select(`DISTINCT (${distinctField})`, fieldAlias)
      .andWhere(`${distinctField} IS NOT NULL`)
      .andWhere(`${distinctField} != ''`)
      .orderBy(fieldAlias, 'ASC');

    const totalRaw = await qb.getRawMany();
    const allItems = totalRaw
      .map((r) => r[fieldAlias])
      .filter((v) => v !== null && v !== undefined && v !== '');

    const total = allItems.length;
    const items = allItems.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize,
    );

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!data) throw new NotFoundException('Không tìm thấy khoản chi');

    const pYear =
      data.periodYear ||
      (data.documentDate ? new Date(data.documentDate).getFullYear() : 2026);
    const pMonth =
      data.periodMonth ||
      (data.documentDate ? new Date(data.documentDate).getMonth() + 1 : 1);

    const formatted = {
      ...data,
      periodYear: pYear,
      periodMonth: pMonth,
      totalAmount: Number(data.totalAmount) || 0,
      amount: Number(data.totalAmount) || 0,
      period: `${String(pMonth).padStart(2, '0')}/${pYear}`,
    };

    return { data: formatted };
  }

  async update(id: string, dto: any) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');

    if (dto.expense_no !== undefined || dto.expenseNo !== undefined)
      record.expenseNo = dto.expense_no ?? dto.expenseNo;
    if (dto.branch_id !== undefined || dto.branchId !== undefined)
      record.branchId = dto.branch_id ?? dto.branchId;
    if (dto.supplier_id !== undefined || dto.supplierId !== undefined)
      record.supplierId = dto.supplier_id ?? dto.supplierId;
    if (
      dto.supplier_name_snapshot !== undefined ||
      dto.supplierNameSnapshot !== undefined
    )
      record.supplierNameSnapshot =
        dto.supplier_name_snapshot ?? dto.supplierNameSnapshot;
    if (dto.expense_category !== undefined || dto.expenseCategory !== undefined)
      record.expenseCategory = dto.expense_category ?? dto.expenseCategory;
    if (dto.category_key !== undefined || dto.categoryKey !== undefined)
      record.categoryKey = dto.category_key ?? dto.categoryKey;
    if (dto.cost_group !== undefined || dto.costGroup !== undefined)
      record.costGroup = dto.cost_group ?? dto.costGroup;
    if (dto.title !== undefined) record.title = dto.title;
    if (dto.period_year !== undefined || dto.periodYear !== undefined)
      record.periodYear = Number(dto.period_year ?? dto.periodYear);
    if (dto.period_month !== undefined || dto.periodMonth !== undefined)
      record.periodMonth = Number(dto.period_month ?? dto.periodMonth);
    if (dto.document_date !== undefined || dto.documentDate !== undefined)
      record.documentDate = dto.document_date ?? dto.documentDate;
    if (dto.due_date !== undefined || dto.dueDate !== undefined)
      record.dueDate = dto.due_date ?? dto.dueDate;
    if (dto.invoice_status !== undefined || dto.invoiceStatus !== undefined)
      record.invoiceStatus = dto.invoice_status ?? dto.invoiceStatus;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.payment_status !== undefined || dto.paymentStatus !== undefined)
      record.paymentStatus = dto.payment_status ?? dto.paymentStatus;
    if (
      dto.total_amount !== undefined ||
      dto.totalAmount !== undefined ||
      dto.amount !== undefined
    )
      record.totalAmount = Number(
        dto.total_amount ?? dto.totalAmount ?? dto.amount,
      );
    if (dto.recurrence_type !== undefined || dto.recurrenceType !== undefined)
      record.recurrenceType = dto.recurrence_type ?? dto.recurrenceType;
    if (
      dto.recurrence_interval !== undefined ||
      dto.recurrenceInterval !== undefined
    )
      record.recurrenceInterval = Number(
        dto.recurrence_interval ?? dto.recurrenceInterval,
      );
    if (
      dto.recurrence_until_year !== undefined ||
      dto.recurrenceUntilYear !== undefined
    )
      record.recurrenceUntilYear = dto.recurrence_until_year
        ? Number(dto.recurrence_until_year ?? dto.recurrenceUntilYear)
        : null;
    if (
      dto.recurrence_until_month !== undefined ||
      dto.recurrenceUntilMonth !== undefined
    )
      record.recurrenceUntilMonth = dto.recurrence_until_month
        ? Number(dto.recurrence_until_month ?? dto.recurrenceUntilMonth)
        : null;
    if (
      dto.recurrence_anchor_id !== undefined ||
      dto.recurrenceAnchorId !== undefined
    )
      record.recurrenceAnchorId =
        dto.recurrence_anchor_id ?? dto.recurrenceAnchorId;
    if (dto.notes !== undefined || dto.note !== undefined)
      record.notes = dto.notes ?? dto.note;

    const updated = await this.repository.save(record);

    const formatted = {
      ...updated,
      totalAmount: Number(updated.totalAmount) || 0,
      amount: Number(updated.totalAmount) || 0,
      period: `${String(updated.periodMonth || 1).padStart(2, '0')}/${updated.periodYear || 2026}`,
    };

    return { message: 'Cập nhật khoản chi thành công', data: formatted };
  }

  async applyRecurring(
    id: string,
    dto: ApplyRecurringOperatingExpenseDto,
    userId?: string,
  ) {
    const item = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!item) throw new NotFoundException('Không tìm thấy khoản chi');

    if (dto.amount !== undefined) item.totalAmount = Number(dto.amount) || 0;
    if (dto.categoryKey !== undefined) {
      item.categoryKey = dto.categoryKey;
      item.expenseCategory = dto.categoryKey;
    }
    if (dto.costGroup !== undefined) item.costGroup = dto.costGroup;
    if (dto.title !== undefined) item.title = dto.title;
    if (dto.notes !== undefined || dto.note !== undefined)
      item.notes = dto.notes ?? dto.note ?? null;
    if (dto.recurrenceType !== undefined)
      item.recurrenceType = dto.recurrenceType;
    if (dto.untilYear !== undefined)
      item.recurrenceUntilYear = dto.untilYear ? Number(dto.untilYear) : null;
    if (dto.untilMonth !== undefined)
      item.recurrenceUntilMonth = dto.untilMonth
        ? Number(dto.untilMonth)
        : null;

    const saved = await this.repository.save(item);

    if (dto.applyScope === 'this') {
      return {
        updated: 1,
        created: 0,
        total: 1,
        item: {
          ...saved,
          totalAmount: Number(saved.totalAmount) || 0,
          amount: Number(saved.totalAmount) || 0,
          period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
        },
      };
    }

    // Apply for this and all future periods in recurrence range
    const anchorId = item.recurrenceAnchorId || item.id;
    let startYear = Number(item.periodYear || 2026);
    let startMonth = Number(item.periodMonth || 1) + 1;
    if (startMonth > 12) {
      startMonth = 1;
      startYear += 1;
    }

    const endYear = dto.untilYear
      ? Number(dto.untilYear)
      : item.recurrenceUntilYear
        ? Number(item.recurrenceUntilYear)
        : (item.periodYear || 2026) + 1;
    const endMonth = dto.untilMonth
      ? Number(dto.untilMonth)
      : item.recurrenceUntilMonth
        ? Number(item.recurrenceUntilMonth)
        : item.periodMonth || 12;

    const periods: Array<{ year: number; month: number }> = [];
    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      periods.push({ year: curY, month: curM });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }

    let updatedCount = 0;
    let createdCount = 0;

    for (const p of periods) {
      const existing = await this.repository.findOne({
        where: {
          periodYear: p.year,
          periodMonth: p.month,
          recurrenceAnchorId: anchorId,
          isDeleted: false,
        },
      });

      if (existing) {
        existing.totalAmount = item.totalAmount;
        existing.title = item.title;
        existing.categoryKey = item.categoryKey;
        existing.expenseCategory = item.expenseCategory;
        existing.costGroup = item.costGroup;
        existing.notes = item.notes;
        existing.recurrenceType = item.recurrenceType;
        existing.recurrenceUntilYear = item.recurrenceUntilYear;
        existing.recurrenceUntilMonth = item.recurrenceUntilMonth;
        existing.recurrenceAnchorId = anchorId;
        await this.repository.save(existing);
        updatedCount++;
      } else {
        const expenseNo = await this.generateExpenseNo(
          this.dataSource.manager,
          `${p.year}-${String(p.month).padStart(2, '0')}-01`,
        );
        const newItem = this.repository.create({
          expenseNo,
          branchId: item.branchId,
          supplierId: item.supplierId,
          supplierNameSnapshot: item.supplierNameSnapshot,
          categoryKey: item.categoryKey,
          expenseCategory: item.expenseCategory,
          costGroup: item.costGroup,
          title: item.title,
          periodYear: p.year,
          periodMonth: p.month,
          documentDate: `${p.year}-${String(p.month).padStart(2, '0')}-01`,
          status: item.status,
          paymentStatus: 'UNPAID',
          totalAmount: item.totalAmount,
          recurrenceType: item.recurrenceType,
          recurrenceInterval: 1,
          recurrenceUntilYear: item.recurrenceUntilYear,
          recurrenceUntilMonth: item.recurrenceUntilMonth,
          recurrenceAnchorId: anchorId,
          notes: item.notes,
          createdBy: userId || null,
        });
        await this.repository.save(newItem);
        createdCount++;
      }
    }

    return {
      updated: updatedCount + 1,
      created: createdCount,
      total: updatedCount + 1 + createdCount,
      item: {
        ...saved,
        totalAmount: Number(saved.totalAmount) || 0,
        amount: Number(saved.totalAmount) || 0,
        period: `${String(saved.periodMonth).padStart(2, '0')}/${saved.periodYear}`,
      },
    };
  }

  async softDelete(id: string, scope?: string) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');

    record.isDeleted = true;
    await this.repository.save(record);

    if (scope === 'this_and_future' && record.recurrenceAnchorId) {
      const anchorId = record.recurrenceAnchorId;
      const currentPeriodInt =
        (record.periodYear || 2026) * 100 + (record.periodMonth || 1);

      await this.repository
        .createQueryBuilder()
        .update(ErpOperatingExpense)
        .set({ isDeleted: true })
        .where('recurrenceAnchorId = :anchorId', { anchorId })
        .andWhere('(periodYear * 100 + periodMonth) >= :currentPeriodInt', {
          currentPeriodInt,
        })
        .execute();
    }

    return { message: 'Xóa khoản chi thành công', success: true };
  }

  async findUnpaid() {
    return this.repository.find({
      where: {
        isDeleted: false,
        paymentStatus: Not('PAID'),
        status: Not('CANCELLED'),
      },
    });
  }

  async findRecurring() {
    return this.repository.find({
      where: {
        isDeleted: false,
        autoGenerateNext: true,
        status: Not('CANCELLED'),
      },
    });
  }
}
