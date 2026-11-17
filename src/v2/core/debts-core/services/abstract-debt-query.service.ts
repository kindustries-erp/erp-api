import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  emptyOptionsPage,
  findTableColumnOptions,
  parseListFilterPayload,
  parseSummaryKeys,
  resolveTableColumn,
  type TableColumnMap,
  type TableFilterPayload,
  type TableOptionsPage,
  type TableSortDefault,
  type TableSummaryColumn,
} from '@/common/utils/table-query';
import { applyMultiKeywordMultiFieldFilter } from '@/common/utils/query-builder.util';
import { buildPagination } from '@/common/utils/paginated-result';
import type {
  DebtListQuery,
  DebtListResult,
} from '../contracts/debt-list.contract';

export const DEBT_QUERY_MAX_PAGE_SIZE = 200;
export const DEBT_QUERY_DEFAULT_PAGE_SIZE = 20;

/**
 * Khung đọc danh sách công nợ dùng chung (abstract, không @Injectable, không entity).
 * Module con khai báo whitelist cột, truy vấn gốc và cách lấy trang; khung lo phân trang
 * (kẹp pageSize), tìm kiếm, bộ lọc, sắp xếp, `summaries` và gợi ý giá trị cột.
 * SQL chỉ lấy từ whitelist của lớp con, không bao giờ từ input.
 */
export abstract class AbstractDebtQueryService<
  TRow,
  TEntity extends ObjectLiteral = ObjectLiteral,
> {
  /** Cột lọc/sắp xếp được phép (khóa: tên cột client gửi lên). */
  protected abstract readonly columns: TableColumnMap;
  /** Cột số được phép tính `summaries`. */
  protected abstract readonly summaryColumns: TableSummaryColumn[];
  /** Cột cho ô tìm kiếm chung (ILIKE). */
  protected abstract readonly searchColumns: string[];
  protected abstract readonly defaultSort: TableSortDefault;
  /** Cột bảo đảm thứ tự ổn định khi sort trùng giá trị. */
  protected abstract readonly tieBreaker: string;

  /** Truy vấn gốc đã có điều kiện bắt buộc (chi nhánh, chưa xóa, ...). */
  protected abstract createBaseQuery(
    query: DebtListQuery,
  ): SelectQueryBuilder<TEntity>;

  /** Lấy một trang đã sort. Lớp con ánh xạ sang dòng response (không trả Entity). */
  protected abstract fetchPage(
    qb: SelectQueryBuilder<TEntity>,
    offset: number,
    limit: number,
  ): Promise<{ rows: TRow[]; total: number }>;

  async findPage(
    query: DebtListQuery & Record<string, unknown>,
  ): Promise<DebtListResult<TRow>> {
    const { page, pageSize } = this.resolvePaging(query);
    const qb = this.createBaseQuery(query);

    const keyword = query.search?.trim();
    if (keyword) {
      applyMultiKeywordMultiFieldFilter(
        qb,
        this.searchColumns,
        keyword,
        'debt_search',
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
    const { rows, total } = await this.fetchPage(
      qb,
      (page - 1) * pageSize,
      pageSize,
    );
    return {
      items: rows,
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
    query: DebtListQuery & Record<string, unknown> = {},
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

  /**
   * Cách lấy trang cho truy vấn gom nhóm dựng bằng `FROM (subquery) g`: đếm số dòng rồi
   * đọc `g.*` theo offset/limit. Lớp con gọi trong `fetchPage` kèm hàm ánh xạ dòng thô.
   */
  protected async fetchRawPage<R>(
    qb: SelectQueryBuilder<TEntity>,
    offset: number,
    limit: number,
    map: (raw: Record<string, unknown>) => R,
  ): Promise<{ rows: R[]; total: number }> {
    const count = await qb
      .clone()
      .select('COUNT(*)', 'total')
      .orderBy()
      .getRawOne<{ total: string }>();
    const raw = await qb
      .clone()
      .select('g.*')
      .offset(offset)
      .limit(limit)
      .getRawMany<Record<string, unknown>>();
    return { rows: raw.map(map), total: Number(count?.total ?? 0) };
  }

  protected resolvePaging(input: {
    page?: number | string;
    pageSize?: number | string;
  }): { page: number; pageSize: number } {
    const page = Math.max(1, Math.floor(Number(input.page)) || 1);
    const pageSize = Math.max(
      1,
      Math.min(
        DEBT_QUERY_MAX_PAGE_SIZE,
        Math.floor(Number(input.pageSize)) || DEBT_QUERY_DEFAULT_PAGE_SIZE,
      ),
    );
    return { page, pageSize };
  }
}
