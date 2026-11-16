import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { applyMultiKeywordFilter } from '@/common/utils/query-builder.util';
import { buildPagination } from '@/common/utils/paginated-result';
import { KgaraCase } from '@/kgara-api-core/entities/kgara_case.entity';
import { KgaraGrossProfit } from '@/kgara-api-core/entities/kgara_gross_profit.entity';
import {
  applyCaseOptionFilters,
  getCaseColumnSelectExpr,
} from '@/kgara-api-core/helpers/kgara-case-filter.helper';

/** Gợi ý giá trị cột của danh sách vụ việc (distinct, phân trang). */
@Injectable()
export class CaseColumnOptionsService {
  constructor(
    @InjectRepository(KgaraCase) private readonly cases: Repository<KgaraCase>,
  ) {}

  /** Gợi ý giá trị của một cột (distinct), áp dụng bộ lọc các cột khác. Cột lạ trả trang rỗng. */
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
    const expr = getCaseColumnSelectExpr(column);
    if (!expr) {
      return { items: [], pagination: buildPagination(page, pageSize, 0) };
    }
    const qb = this.cases
      .createQueryBuilder('case')
      .where('case.branchExternalId = :branchId', { branchId })
      .leftJoin('case.category', 'cat')
      .leftJoin(KgaraGrossProfit, 'gp', 'gp.vuViecCode = case.soChungTu')
      .select(`DISTINCT ${expr}`, 'value')
      .andWhere('case.kgaraDeletedAt IS NULL')
      .andWhere(`${expr} IS NOT NULL`)
      .andWhere(`CAST(${expr} AS TEXT) != ''`);
    applyCaseOptionFilters(qb, column, opts.filters);
    if (opts.search) {
      applyMultiKeywordFilter(
        qb,
        `CAST(${expr} AS TEXT)`,
        opts.search,
        'opt_search',
      );
    }
    const count = await qb
      .clone()
      .orderBy()
      .select(`COUNT(DISTINCT ${expr})`, 'cnt')
      .getRawOne<{ cnt: string }>();
    const raw = await qb
      .orderBy('value', 'ASC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ value: unknown }>();
    return {
      items: raw
        .map((r) => String(r.value))
        .filter(Boolean)
        .map((v) => ({ label: v, value: v })),
      pagination: buildPagination(page, pageSize, Number(count?.cnt) || 0),
    };
  }
}
