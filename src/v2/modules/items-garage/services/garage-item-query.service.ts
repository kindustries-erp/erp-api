import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarageItem } from '../entities/garage-item.entity';
import { QueryGarageItemDto } from '../dto/query-garage-item.dto';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyDateBounds,
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseFilterRecord,
  parseSummaryKeys,
  resolveTableColumn,
  SummaryMetric,
  TableColumnMap,
  TableDateRange,
  TableFilterPayload,
  TableOperatorFilter,
  TableOptionsPage,
} from '@/common/utils/table-query';

/** Cột lọc, sắp xếp và tổng (whitelist, không nhận biểu thức từ client). */
const TABLE_COLUMNS: TableColumnMap = {
  createdAt: { sql: 'e.createdAt', type: 'date' },
  created_at: { sql: 'e.createdAt', type: 'date' },
  itemCode: { sql: 'e.itemCode', type: 'text' },
  item_code: { sql: 'e.itemCode', type: 'text' },
  itemName: { sql: 'e.itemName', type: 'text' },
  item_name: { sql: 'e.itemName', type: 'text' },
  unit: { sql: 'e.unit', type: 'text' },
  itemType: { sql: 'e.itemType', type: 'text' },
  item_type: { sql: 'e.itemType', type: 'text' },
  source: { sql: 'e.source', type: 'text' },
};

/** Cột số được tổng qua `summary_keys` (whitelist SQL; key ngoài danh sách trả `null`). */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
const SEARCH_COLUMNS: string[] = [
  'e.itemCode',
  'e.itemName',
  'e.nameNormalized',
  'e.unit',
  'e.itemType',
  'e.source',
];

export interface GarageItemPageResult {
  items: GarageItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Theo key trong `summary_keys`: `{ total, pageSubtotal, cumulative }` hoặc `null` */
  summaries: Record<string, SummaryMetric | null>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class GarageItemQueryService {
  constructor(
    @InjectRepository(GarageItem)
    private readonly repo: Repository<GarageItem>,
  ) {}

  async findAll(query: QueryGarageItemDto): Promise<GarageItemPageResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(query.pageSize) || 20));
    const qb = this.baseQuery();

    const keyword = query.search?.trim();
    if (keyword && SEARCH_COLUMNS.length > 0) {
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

    // Tổng theo summary_keys tính trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
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

  /** Gợi ý giá trị của một cột, áp dụng bộ lọc của các cột khác. */
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

  findById(id: string): Promise<GarageItem | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryGarageItemDto): TableFilterPayload {
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
      dateRanges: parseFilterRecord<Record<string, TableDateRange>>(
        query.date_ranges,
      ),
    };
  }

  /** Nhận cả payload đầy đủ lẫn dạng rút gọn `{ cột: [giá trị] }` từ bảng V2. */
  private toPayload(raw: unknown): TableFilterPayload {
    const parsed = parseFilterRecord<
      TableFilterPayload & Record<string, unknown>
    >(raw);
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
