import { Injectable } from '@nestjs/common';
import {
  emptyOptionsPage,
  applyTableFilters,
  findTableColumnOptions,
  parseListFilterPayload,
  resolveTableColumn,
} from '@/common/utils/table-query';
import { CASE_COLUMNS } from '../helpers/case-query.columns';
import { CaseListQueryService } from './case-list-query.service';

/** Gợi ý giá trị cột của danh sách vụ việc (distinct, phân trang), áp bộ lọc các cột khác. */
@Injectable()
export class CaseColumnOptionsService {
  constructor(private readonly list: CaseListQueryService) {}

  async findOptions(
    branchId: string,
    column: string,
    opts: {
      search?: string;
      page?: number;
      pageSize?: number;
      filters?: string;
    },
  ) {
    const page = Math.max(1, Math.floor(opts.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(opts.pageSize ?? 20) || 20),
    );
    const def = resolveTableColumn(CASE_COLUMNS, column);
    if (!def) return emptyOptionsPage(page, pageSize);
    const qb = this.list.baseQuery({ branchId });
    applyTableFilters(
      qb,
      parseListFilterPayload({ column_filters: opts.filters }),
      CASE_COLUMNS,
      'opt',
      column,
    );
    return findTableColumnOptions(qb, def, opts.search, page, pageSize);
  }
}
