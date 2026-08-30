import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, Repository, Not, Brackets } from 'typeorm';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { CreateOperatingExpenseDto } from './dto/create-operating-expense.dto';
import { OperationalQueryDto } from '../operational-documents/dto/operational-document.dto';
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

  async create(dto: CreateOperatingExpenseDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ErpOperatingExpense);
      const expenseNo =
        dto.expense_no?.trim() ||
        (await this.generateExpenseNo(manager, dto.document_date));
      const payload: DeepPartial<ErpOperatingExpense> = {
        expenseNo,
        branchId: dto.branch_id ?? null,
        supplierId: dto.supplier_id ?? null,
        supplierNameSnapshot: dto.supplier_name_snapshot ?? null,
        expenseCategory: dto.expense_category ?? null,
        title: dto.title ?? null,
        documentDate: dto.document_date ?? null,
        dueDate: dto.due_date ?? null,
        invoiceStatus: dto.invoice_status ?? 'NOT_REQUIRED',
        status: dto.status ?? 'DRAFT',
        paymentStatus: 'UNPAID', // Default initial state
        totalAmount: dto.total_amount ?? 0,
        recurrenceType: dto.recurrence_type ?? 'ONE_TIME',
        recurrenceInterval: dto.recurrence_interval ?? 1,
        recurrenceStartDate: dto.recurrence_start_date ?? null,
        recurrenceEndDate: dto.recurrence_end_date ?? null,
        nextDueDate: dto.next_due_date ?? null,
        autoGenerateNext: dto.auto_generate_next ?? false,
        parentRecurringId: dto.parent_recurring_id ?? null,
        notes: dto.notes ?? null,
      };
      const data = await repo.save(payload);
      return { message: 'Tạo khoản chi thành công', data };
    });
  }

  private mapColumnToSqlField(column: string): string | null {
    const map: Record<string, string> = {
      expenseNo: 'exp.expenseNo',
      expense_no: 'exp.expenseNo',
      doc_no: 'exp.expenseNo',
      title: 'exp.title',
      expenseCategory: 'exp.expenseCategory',
      expense_category: 'exp.expenseCategory',
      status: 'exp.status',
      paymentStatus: 'exp.paymentStatus',
      payment_status: 'exp.paymentStatus',
      invoiceStatus: 'exp.invoiceStatus',
      invoice_status: 'exp.invoiceStatus',
      recurrenceType: 'exp.recurrenceType',
      recurrence_type: 'exp.recurrenceType',
      recurrenceInterval: 'exp.recurrenceInterval',
      recurrence_interval: 'exp.recurrenceInterval',
      supplierNameSnapshot: 'exp.supplierNameSnapshot',
      supplier_name_snapshot: 'exp.supplierNameSnapshot',
      notes: 'exp.notes',
      documentDate: 'exp.documentDate',
      document_date: 'exp.documentDate',
      nextDueDate: 'exp.nextDueDate',
      next_due_date: 'exp.nextDueDate',
      dueDate: 'exp.dueDate',
      due_date: 'exp.dueDate',
      totalAmount: 'exp.totalAmount',
      total_amount: 'exp.totalAmount',
      createdAt: 'exp.createdAt',
      created_at: 'exp.createdAt',
    };
    return map[column] || null;
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const qb = this.repository.createQueryBuilder('exp');

    qb.where('exp.isDeleted = false');

    if (query.branch_id || query.branchId) {
      qb.andWhere('exp.branchId = :branchId', {
        branchId: query.branch_id || query.branchId,
      });
    }
    if (query.status) {
      qb.andWhere('exp.status = :status', { status: query.status });
    }
    if (query.payment_status || query.paymentStatus) {
      qb.andWhere('exp.paymentStatus = :paymentStatus', {
        paymentStatus: query.payment_status || query.paymentStatus,
      });
    }
    if (query.recurrence_type || query.recurrenceType) {
      qb.andWhere('exp.recurrenceType = :recurrenceType', {
        recurrenceType: query.recurrence_type || query.recurrenceType,
      });
    }
    if (query.search) {
      qb.andWhere('(exp.expenseNo ILIKE :search OR exp.title ILIKE :search)', {
        search: `%${query.search}%`,
      });
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
        });
      } catch (e) {
        // ignore parse error
      }
    }

    // Column Filters (array of values or __BLANK__ or __ALL_MATCHING__)
    if (query.column_filters) {
      try {
        const colFilters: Record<string, string[]> =
          typeof query.column_filters === 'string'
            ? JSON.parse(query.column_filters)
            : query.column_filters;

        Object.entries(colFilters).forEach(([colKey, values], idx) => {
          if (Array.isArray(values) && values.length > 0) {
            const sqlField = this.mapColumnToSqlField(colKey);
            if (sqlField) {
              // 1. Xử lý __ALL_MATCHING__ (Chọn tất cả kết quả tìm kiếm)
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

    // Date Range Filters
    const dateFrom = query.date_from || query.dateFrom;
    const dateTo = query.date_to || query.dateTo;
    const dateField = query.date_field
      ? this.mapColumnToSqlField(query.date_field) || 'exp.documentDate'
      : 'exp.documentDate';

    if (dateFrom) {
      qb.andWhere(`${dateField} >= :dateFrom`, { dateFrom });
    }
    if (dateTo) {
      qb.andWhere(`${dateField} <= :dateTo`, { dateTo });
    }

    // Calculate sum of total_amount before applying orderBy/pagination
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
        const sqlField = this.mapColumnToSqlField(cleanKey);
        if (sqlField) {
          if (idx === 0) {
            qb.orderBy(sqlField, isDesc ? 'DESC' : 'ASC');
          } else {
            qb.addOrderBy(sqlField, isDesc ? 'DESC' : 'ASC');
          }
        }
      });
    } else if (query.sortField) {
      const sqlField = this.mapColumnToSqlField(query.sortField);
      if (sqlField) {
        const dir = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        qb.orderBy(sqlField, dir);
      }
    } else {
      qb.orderBy('exp.createdAt', 'DESC');
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

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
    const rawSqlField = this.mapColumnToSqlField(column);
    if (!rawSqlField) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const qb = this.repository.createQueryBuilder('exp');
    qb.where('exp.isDeleted = false');

    if (branchId) {
      qb.andWhere('exp.branchId = :branchId', { branchId });
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
              if (values[0] === '__ALL_MATCHING__') {
                const searchStr = (values[1] || '').trim();
                if (searchStr) {
                  applyMultiKeywordFilter(
                    qb,
                    `CAST(${sqlField} AS text)`,
                    searchStr,
                    `c_opt_flt_all_${idx}`,
                  );
                }
                return;
              }

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
      applyMultiKeywordFilter(
        qb,
        `CAST(${rawSqlField} AS text)`,
        search.trim(),
        'col_opt_search',
      );
    }

    // Distinct query with safe cast to text
    qb.select(`CAST(${rawSqlField} AS text)`, 'value')
      .distinct(true)
      .andWhere(`${rawSqlField} IS NOT NULL`)
      .andWhere(`CAST(${rawSqlField} AS text) != ''`)
      .orderBy('value', 'ASC');

    const totalRaw = await qb.getRawMany();
    const total = totalRaw.length;

    const rawItems = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    const items = rawItems
      .map((r) => r.value)
      .filter((v) => v !== null && v !== undefined && v !== '');

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const data = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!data) throw new NotFoundException('Không tìm thấy khoản chi');
    return { data };
  }

  async update(id: string, dto: any) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');

    // Map DTO snake_case to entity camelCase manually
    if (dto.expense_no !== undefined) record.expenseNo = dto.expense_no;
    if (dto.branch_id !== undefined) record.branchId = dto.branch_id;
    if (dto.supplier_id !== undefined) record.supplierId = dto.supplier_id;
    if (dto.supplier_name_snapshot !== undefined)
      record.supplierNameSnapshot = dto.supplier_name_snapshot;
    if (dto.expense_category !== undefined)
      record.expenseCategory = dto.expense_category;
    if (dto.title !== undefined) record.title = dto.title;
    if (dto.document_date !== undefined)
      record.documentDate = dto.document_date;
    if (dto.due_date !== undefined) record.dueDate = dto.due_date;
    if (dto.invoice_status !== undefined)
      record.invoiceStatus = dto.invoice_status;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.total_amount !== undefined) record.totalAmount = dto.total_amount;
    if (dto.recurrence_type !== undefined)
      record.recurrenceType = dto.recurrence_type;
    if (dto.recurrence_interval !== undefined)
      record.recurrenceInterval = dto.recurrence_interval;
    if (dto.recurrence_start_date !== undefined)
      record.recurrenceStartDate = dto.recurrence_start_date;
    if (dto.recurrence_end_date !== undefined)
      record.recurrenceEndDate = dto.recurrence_end_date;
    if (dto.next_due_date !== undefined) record.nextDueDate = dto.next_due_date;
    if (dto.auto_generate_next !== undefined)
      record.autoGenerateNext = dto.auto_generate_next;
    if (dto.notes !== undefined) record.notes = dto.notes;

    const updated = await this.repository.save(record);
    return { message: 'Cập nhật khoản chi thành công', data: updated };
  }

  async softDelete(id: string) {
    const record = await this.repository.findOne({
      where: { id, isDeleted: false },
    });
    if (!record) throw new NotFoundException('Không tìm thấy khoản chi');
    record.isDeleted = true;
    await this.repository.save(record);
    return { message: 'Xóa khoản chi thành công' };
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
