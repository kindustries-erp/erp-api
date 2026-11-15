import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ErpEmployee } from '@/employees-core/entities/erp_employee.entity';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseSummaryKeys,
  resolveTableColumn,
  SummaryMetric,
  TableColumnMap,
  TableDateRange,
  TableFilterPayload,
  TableOperatorFilter,
  TableOptionsPage,
} from '@/common/utils/table-query';
import { parseStrictJsonParam } from '@/v2/core/users-core';
import { ColumnOptionsQueryDto } from '../dto/column-options-query.dto';
import { QueryUserDto } from '../dto/query-user.dto';
import { UsersManagement } from '../entities/users-management.entity';
import { pullFromLegacyCoreUsers } from './legacy-core-user.sync';

/** Cột lọc, sắp xếp (whitelist, không nhận biểu thức từ client). `emp` là nhân viên liên kết. */
const TABLE_COLUMNS: TableColumnMap = {
  email: { sql: 'e.email', type: 'text' },
  status: { sql: 'e.status', type: 'text' },
  employee: { sql: 'emp.fullName', type: 'text' },
  employeeName: { sql: 'emp.fullName', type: 'text' },
  employeeCode: { sql: 'emp.employeeCode', type: 'text' },
  lastLoginAt: { sql: 'e.lastLoginAt', type: 'date' },
  last_login_at: { sql: 'e.lastLoginAt', type: 'date' },
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
};

/** Bảng users không có cột số cần tổng. */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [];

const SEARCH_COLUMNS = ['e.email', 'emp.fullName', 'emp.employeeCode'];

export interface UserPageResult {
  items: UsersManagement[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, SummaryMetric | null>;
}

/** Đọc dữ liệu tài khoản: chỉ dòng chưa xóa mềm. JSON filter sai định dạng trả 400. */
@Injectable()
export class UsersManagementQueryService {
  constructor(
    @InjectRepository(UsersManagement)
    private readonly repo: Repository<UsersManagement>,
    @InjectRepository(ErpEmployee)
    private readonly employees: Repository<ErpEmployee>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryUserDto): Promise<UserPageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery();
    this.readFilters(query); // JSON sai trả 400 trước khi chạm DB
    await pullFromLegacyCoreUsers(this.dataSource.manager);

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }
    const keyword = query.search?.trim();
    if (keyword) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        SEARCH_COLUMNS,
        keyword,
        'global_search',
      );
    }
    applyTableFilters(qb, this.readFilters(query), TABLE_COLUMNS, 'filter');
    applyDateBounds(
      qb,
      'e.createdAt',
      query.date_from,
      query.date_to,
      'legacy',
    );
    applyTableSort(
      qb,
      query.sort,
      TABLE_COLUMNS,
      { sql: 'e.createdAt', direction: 'DESC' },
      'e.id',
    );

    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_COLUMNS,
      keys: parseSummaryKeys(query.summary_keys),
      page,
      pageSize,
      tieBreaker: 'e.id',
    });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize, summaries };
  }

  async findColumnOptions(
    query: ColumnOptionsQueryDto,
  ): Promise<TableOptionsPage> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const def = resolveTableColumn(TABLE_COLUMNS, query.column);
    if (!def) return emptyOptionsPage(page, pageSize);

    const payload = this.toPayload(
      parseStrictJsonParam(query.filters, 'filters'),
    );
    await pullFromLegacyCoreUsers(this.dataSource.manager);
    const qb = this.baseQuery();
    applyTableFilters(qb, payload, TABLE_COLUMNS, 'col_opt', query.column);
    return findTableColumnOptions(qb, def, query.search, page, pageSize);
  }

  async findById(id: string): Promise<UsersManagement | null> {
    await pullFromLegacyCoreUsers(this.dataSource.manager, id);
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  /** Nhân viên theo danh sách id, trả Map để ghép vào response. */
  async findEmployeeMap(
    ids: (string | null)[],
  ): Promise<Map<string, ErpEmployee>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const rows = await this.employees.find({ where: { id: In(unique) } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .leftJoin(ErpEmployee, 'emp', 'emp.id = e.employeeId')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryUserDto): TableFilterPayload {
    return {
      columnFilters: parseStrictJsonParam<Record<string, string[]>>(
        query.column_filters,
        'column_filters',
      ),
      columnSearch: parseStrictJsonParam<Record<string, string>>(
        query.column_search,
        'column_search',
      ),
      columnOperators: parseStrictJsonParam<
        Record<string, TableOperatorFilter>
      >(query.column_operators, 'column_operators'),
      dateRanges: parseStrictJsonParam<Record<string, TableDateRange>>(
        query.date_ranges,
        'date_ranges',
      ),
    };
  }

  /** Nhận cả payload đầy đủ lẫn dạng rút gọn `{ cột: [giá trị] }` từ bảng V2. */
  private toPayload(
    parsed: (TableFilterPayload & Record<string, unknown>) | undefined,
  ): TableFilterPayload {
    if (!parsed) return {};
    const hasEnvelope = [
      'columnFilters',
      'columnSearch',
      'columnOperators',
      'dateRanges',
    ].some((key) => key in parsed);
    return hasEnvelope
      ? parsed
      : { columnFilters: parsed as Record<string, string[]> };
  }
}
