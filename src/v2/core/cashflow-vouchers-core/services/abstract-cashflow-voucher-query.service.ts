import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  buildPagination,
  type PaginationMeta,
} from '@/common/utils/paginated-result';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import {
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseListFilterPayload,
  parseSummaryKeys,
  resolveTableColumn,
  type SummaryMetric,
  type TableColumnMap,
  type TableFilterPayload,
  type TableOptionsPage,
  type TableSortDefault,
  type TableSummaryColumn,
} from '@/common/utils/table-query';

export const CASHFLOW_QUERY_MAX_PAGE_SIZE = 200;

export interface CashflowVoucherListQuery {
  page?: number | string;
  pageSize?: number | string;
  search?: string;
  summary_keys?: string;
  sort?: string;
  column_filters?: unknown;
  column_search?: unknown;
  column_operators?: unknown;
  date_ranges?: unknown;
  [key: string]: unknown;
}

export interface CashflowVoucherListResult<T> {
  items: T[];
  pagination: PaginationMeta;
  summaries: Record<string, SummaryMetric | null>;
}

/**
 * Khung đọc danh sách phiếu thu chi (abstract, không @Injectable). Con khai báo whitelist cột
 * và truy vấn gốc (đã có chi nhánh, chưa xóa); khung lo phân trang, tìm kiếm, lọc, sort, summaries.
 */
export abstract class AbstractCashflowVoucherQueryService<
  TRow,
  TEntity extends ObjectLiteral = ObjectLiteral,
> {
  protected abstract readonly columns: TableColumnMap;
  protected abstract readonly summaryColumns: TableSummaryColumn[];
  protected abstract readonly searchColumns: string[];
  protected abstract readonly defaultSort: TableSortDefault;
  protected abstract readonly tieBreaker: string;

  protected abstract createBaseQuery(
    query: CashflowVoucherListQuery,
  ): SelectQueryBuilder<TEntity>;

  protected abstract toRow(entity: TEntity): TRow;

  async findPage(
    query: CashflowVoucherListQuery,
  ): Promise<CashflowVoucherListResult<TRow>> {
    const { page, pageSize } = this.resolvePaging(query);
    const qb = this.createBaseQuery(query);
    const keyword = query.search?.trim();
    if (keyword) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        this.searchColumns,
        keyword,
        'cf_search',
      );
    }
    applyTableFilters(
      qb,
      parseListFilterPayload(query),
      this.columns,
      'filter',
    );
    applyTableSort(
      qb,
      query.sort,
      this.columns,
      this.defaultSort,
      this.tieBreaker,
    );
    const summaries = await applyListSummaries(qb, {
      columns: this.summaryColumns,
      keys: parseSummaryKeys(query.summary_keys),
      page,
      pageSize,
      tieBreaker: this.tieBreaker,
    });
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: rows.map((r) => this.toRow(r)),
      pagination: buildPagination(page, pageSize, total),
      summaries,
    };
  }

  /** Gợi ý giá trị cột; cột ngoài whitelist trả trang rỗng. */
  async findColumnOptions(
    column: string,
    options: {
      search?: string;
      page?: number | string;
      pageSize?: number | string;
      filters?: TableFilterPayload;
    },
    query: CashflowVoucherListQuery = {},
  ): Promise<TableOptionsPage> {
    const { page, pageSize } = this.resolvePaging(options);
    const def = resolveTableColumn(this.columns, column);
    if (!def) return emptyOptionsPage(page, pageSize);
    const qb = this.createBaseQuery(query);
    applyTableFilters(
      qb,
      options.filters ?? {},
      this.columns,
      'col_opt',
      column,
    );
    return findTableColumnOptions(qb, def, options.search, page, pageSize);
  }

  protected resolvePaging(input: {
    page?: number | string;
    pageSize?: number | string;
  }): { page: number; pageSize: number } {
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const pageSize = Math.max(
      1,
      Math.min(
        CASHFLOW_QUERY_MAX_PAGE_SIZE,
        Math.floor(Number(input.pageSize)) || 20,
      ),
    );
    return { page, pageSize };
  }
}
