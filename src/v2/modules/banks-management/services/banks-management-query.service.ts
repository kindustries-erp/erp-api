import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankManagement } from '../entities/bank-management.entity';
import { BankManagementQueryDto } from '../dto/bank-management-query.dto';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseFilterRecord,
  resolveTableColumn,
  TableColumnMap,
  TableFilterPayload,
  TableOperatorFilter,
  TableOptionsPage,
} from '@/common/utils/table-query';

const TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
  code: { sql: 'e.code', type: 'text' },
  shortName: { sql: 'e.shortName', type: 'text' },
  short_name: { sql: 'e.shortName', type: 'text' },
  name: { sql: 'e.name', type: 'text' },
  bin: { sql: 'e.bin', type: 'text' },
  isActive: { sql: 'e.isActive', type: 'status' },
  is_active: { sql: 'e.isActive', type: 'status' },
};

const SEARCH_COLUMNS: string[] = ['e.code', 'e.shortName', 'e.name', 'e.bin'];

export interface BankManagementPageResult {
  items: BankManagement[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class BanksManagementQueryService {
  constructor(
    @InjectRepository(BankManagement)
    private readonly repo: Repository<BankManagement>,
  ) {}

  /** Lấy danh mục ngân hàng active phục vụ lookup dropdown và QR generator */
  async findActiveCatalog(): Promise<BankManagement[]> {
    return this.repo.find({
      where: { isActive: true, isDeleted: false },
      order: { shortName: 'ASC', code: 'ASC' },
    });
  }

  async findAll(
    query: BankManagementQueryDto,
  ): Promise<BankManagementPageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 50));
    const qb = this.baseQuery();

    const keyword = query.search?.trim();
    if (keyword && SEARCH_COLUMNS.length > 0) {
      applyMultiKeywordMultiFieldFilter(qb, SEARCH_COLUMNS, keyword, 'search');
    }

    applyTableFilters(qb, this.readFilters(query), TABLE_COLUMNS, 'filter');
    applyTableSort(
      qb,
      query.sort,
      TABLE_COLUMNS,
      { sql: 'e.shortName', direction: 'ASC' },
      'e.id',
    );

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  findById(id: string): Promise<BankManagement | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  findByBin(bin: string): Promise<BankManagement | null> {
    return this.repo.findOne({ where: { bin, isDeleted: false } });
  }

  findByCode(code: string): Promise<BankManagement | null> {
    return this.repo.findOne({ where: { code, isDeleted: false } });
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

    const qb = this.baseQuery();
    applyTableFilters(
      qb,
      this.toPayload(filters),
      TABLE_COLUMNS,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, search, page, pageSize);
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: BankManagementQueryDto): TableFilterPayload {
    return {
      columnFilters: parseFilterRecord<Record<string, string[]>>(
        query.column_filters,
      ),
      columnSearch: parseFilterRecord<Record<string, string>>(
        query.column_search,
      ),
      columnOperators: parseFilterRecord<Record<string, TableOperatorFilter>>(
        query.column_operators,
      ),
    };
  }

  private toPayload(raw: unknown): TableFilterPayload {
    const parsed = parseFilterRecord<
      TableFilterPayload & Record<string, unknown>
    >(raw);
    if (!parsed) return {};
    const hasEnvelope = [
      'columnFilters',
      'columnSearch',
      'columnOperators',
    ].some((key) => key in parsed);
    return hasEnvelope
      ? parsed
      : { columnFilters: parsed as Record<string, string[]> };
  }
}
