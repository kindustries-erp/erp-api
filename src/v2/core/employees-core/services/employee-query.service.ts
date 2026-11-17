import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeManagement } from '../entities/employee-management.entity';
import { QueryEmployeeManagementDto } from '../dto/query-employee-management.dto';
import { EmployeeLinkedUserDto } from '../dto/employee-management-response.dto';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyTableFilters,
  applyListSummaries,
  applyTableSort,
  findTableColumnOptions,
  parseSummaryKeys,
  resolveTableColumn,
  SummaryMetric,
  TableColumnMap,
  TableDateRange,
  TableFilterPayload,
  TableOperatorFilter,
  emptyOptionsPage,
  TableOptionsPage,
} from '@/common/utils/table-query';
import { parseStrictJsonParam } from '../helpers/strict-json.helper';

/** Cột lọc, sắp xếp (whitelist). Không có `nationalId`: CCCD không đưa vào lọc/tìm kiếm. */
const TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
  employeeCode: { sql: 'e.employeeCode', type: 'text' },
  employee_code: { sql: 'e.employeeCode', type: 'text' },
  fullName: { sql: 'e.fullName', type: 'text' },
  full_name: { sql: 'e.fullName', type: 'text' },
  email: { sql: 'e.email', type: 'text' },
  phone: { sql: 'e.phone', type: 'text' },
  status: { sql: 'e.status', type: 'status' },
  address: { sql: 'e.address', type: 'text' },
  notes: { sql: 'e.notes', type: 'text' },
  jobTitle: { sql: 'e.jobTitle', type: 'text' },
  job_title: { sql: 'e.jobTitle', type: 'text' },
  department: { sql: 'e.department', type: 'text' },
  branchId: { sql: 'e.branchId', type: 'status' },
  branch_id: { sql: 'e.branchId', type: 'status' },
  birthDate: { sql: 'e.birthDate', type: 'date' },
  birth_date: { sql: 'e.birthDate', type: 'date' },
  startDate: { sql: 'e.startDate', type: 'date' },
  start_date: { sql: 'e.startDate', type: 'date' },
  leaveDate: { sql: 'e.leaveDate', type: 'date' },
  leave_date: { sql: 'e.leaveDate', type: 'date' },
};

/** Chưa có cột số nào được phép tổng. */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [];

/** Ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). Không gồm CCCD. */
const SEARCH_COLUMNS: string[] = [
  'e.employeeCode',
  'e.fullName',
  'e.email',
  'e.phone',
];

export interface EmployeePageResult {
  items: EmployeeManagement[];
  total: number;
  page: number;
  pageSize: number;
  summaries: Record<string, SummaryMetric | null>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột. Chỉ đọc dòng chưa xóa mềm. */
@Injectable()
export class EmployeeQueryService {
  constructor(
    @InjectRepository(EmployeeManagement)
    private readonly repo: Repository<EmployeeManagement>,
  ) {}

  async findAll(
    query: QueryEmployeeManagementDto,
  ): Promise<EmployeePageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery();

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }
    if (query.branchId) {
      qb.andWhere('e.branchId = :branchId', { branchId: query.branchId });
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

  /** Mọi mã đã dùng, kể cả đã xóa mềm, để số thứ tự không bị cấp lại. */
  async findAllCodes(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.employeeCode', 'code')
      .getRawMany<{ code: string }>();
    return rows.map((row) => row.code);
  }

  async findColumnOptions(
    column: string,
    search: string | undefined,
    page: number,
    pageSize: number,
    filters: unknown,
  ): Promise<TableOptionsPage> {
    const def = resolveTableColumn(TABLE_COLUMNS, column);
    if (!def) return emptyOptionsPage(page, pageSize);

    const qb = this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
    applyTableFilters(
      qb,
      this.toPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  findById(id: string): Promise<EmployeeManagement | null> {
    return this.baseQuery().andWhere('e.id = :id', { id }).getOne();
  }

  /** CCCD đầy đủ, chỉ dùng cho endpoint riêng có quyền cập nhật. */
  async findNationalId(id: string): Promise<string | null | undefined> {
    const row = await this.repo.findOne({
      where: { id, isDeleted: false },
      select: { id: true, nationalId: true },
    });
    return row ? row.nationalId : undefined;
  }

  /**
   * Tài khoản liên kết theo `userId`, đọc bảng `users_management` bằng SQL thô
   * để lõi không phụ thuộc module users (một chiều: users → employees).
   */
  async findLinkedUsers(
    userIds: string[],
  ): Promise<Map<string, EmployeeLinkedUserDto>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows: EmployeeLinkedUserDto[] = await this.repo.manager.query(
      'SELECT id, email FROM users_management WHERE id = ANY($1::uuid[])',
      [unique],
    );
    return new Map(
      rows.map((row) => [row.id, { id: row.id, email: row.email }]),
    );
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.branch', 'b')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryEmployeeManagementDto): TableFilterPayload {
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
  private toPayload(raw: unknown): TableFilterPayload {
    const parsed = parseStrictJsonParam<
      TableFilterPayload & Record<string, unknown>
    >(raw, 'filters');
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
