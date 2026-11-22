import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiHubUsageLog } from '../entities/ai-hub-usage-log.entity';
import { QueryAiHubUsageLogDto } from '../dto/query-ai-hub-usage-log.dto';
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
  requestId: { sql: 'e.requestId', type: 'text' },
  request_id: { sql: 'e.requestId', type: 'text' },
  actorUserId: { sql: 'e.actorUserId', type: 'text' },
  actor_user_id: { sql: 'e.actorUserId', type: 'text' },
  featureCode: { sql: 'e.featureCode', type: 'text' },
  feature_code: { sql: 'e.featureCode', type: 'text' },
  tier: { sql: 'e.tier', type: 'text' },
  modelName: { sql: 'e.modelName', type: 'text' },
  model_name: { sql: 'e.modelName', type: 'text' },
  promptTokens: { sql: 'e.promptTokens', type: 'number' },
  prompt_tokens: { sql: 'e.promptTokens', type: 'number' },
  completionTokens: { sql: 'e.completionTokens', type: 'number' },
  completion_tokens: { sql: 'e.completionTokens', type: 'number' },
  totalTokens: { sql: 'e.totalTokens', type: 'number' },
  total_tokens: { sql: 'e.totalTokens', type: 'number' },
  latencyMs: { sql: 'e.latencyMs', type: 'number' },
  latency_ms: { sql: 'e.latencyMs', type: 'number' },
  outcome: { sql: 'e.outcome', type: 'text' },
  errorMessage: { sql: 'e.errorMessage', type: 'text' },
  error_message: { sql: 'e.errorMessage', type: 'text' },
};

/** Cột số được tổng qua `summary_keys` (whitelist SQL; key ngoài danh sách trả `null`). */
const SUMMARY_COLUMNS: { key: string; sql: string }[] = [
  { key: 'promptTokens', sql: 'e.promptTokens' },
  { key: 'completionTokens', sql: 'e.completionTokens' },
  { key: 'totalTokens', sql: 'e.totalTokens' },
  { key: 'latencyMs', sql: 'e.latencyMs' },
];

/** Cột dùng cho ô tìm kiếm chung (ILIKE, nhiều từ khóa cách nhau bằng dấu `;`). */
const SEARCH_COLUMNS: string[] = [
  'e.requestId',
  'e.actorUserId',
  'e.featureCode',
  'e.tier',
  'e.modelName',
  'e.outcome',
  'e.errorMessage',
];

export interface AiHubUsageLogPageResult {
  items: AiHubUsageLog[];
  total: number;
  page: number;
  pageSize: number;
  /** Theo key trong `summary_keys`: `{ total, pageSubtotal, cumulative }` hoặc `null` */
  summaries: Record<string, SummaryMetric | null>;
}

/** Đọc dữ liệu: lọc, sắp xếp, phân trang, gợi ý giá trị cột và tổng. Chỉ đọc các dòng chưa xóa mềm. */
@Injectable()
export class AiHubUsageLogQueryService {
  constructor(
    @InjectRepository(AiHubUsageLog)
    private readonly repo: Repository<AiHubUsageLog>,
  ) {}

  async findAll(
    query: QueryAiHubUsageLogDto,
  ): Promise<AiHubUsageLogPageResult> {
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

  findById(id: string): Promise<AiHubUsageLog | null> {
    return this.repo.findOne({ where: { id, isDeleted: false } });
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .where('e.isDeleted = :isDeleted', { isDeleted: false });
  }

  private readFilters(query: QueryAiHubUsageLogDto): TableFilterPayload {
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
