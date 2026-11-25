import { Injectable } from '@nestjs/common';
import { vnDayBound } from '@/v2/core/base-core/helpers/vn-time.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { applyBranchScope } from '@/v2/core/branches-core';
import { buildPagination } from '@/common/utils/paginated-result';
import {
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  parseFilterRecord,
  parseListFilterPayload,
  parseSummaryKeys,
} from '@/common/utils/table-query';
import { ErpModuleCategory } from '@/module-config/entities/erp_module_category.entity';
import type { CaseListResponse } from '../dto/case-list.types';
import { CaseGarage } from '../entities/case-garage.entity';
import type { CaseOrigin } from '../entities/case-garage.enums';
import { CASE_COLUMNS, CASE_SUMMARY_KEYS } from '../helpers/case-query.columns';
import { applyCaseSpecialFilters } from '../helpers/case-query.special';
import { toCaseListItem } from '../helpers/case-list-item.mapper';
import {
  CaseListEnrichmentService,
  grossProfitKey,
} from './case-list-enrichment.service';

export interface CaseListFilter {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  from?: string;
  to?: string;
  origin?: CaseOrigin;
  column_filters?: string;
  column_search?: string;
  column_operators?: string;
  date_ranges?: string;
  /** `a,-b`: dấu `-` là giảm dần. */
  sort?: string;
  includeDeleted?: boolean;
  summaryKeys?: string;
}

const SEARCH_COLUMNS = [
  'case_code',
  'license_plate',
  'chassis_number',
  'customer_name',
  'customer_code',
  'payer_name',
  'vehicle_brand_name',
  'vehicle_model_name',
];

/**
 * Danh sách vụ việc v2 từ `cases_garage` (cả xe NATIVE và KGARA_SYNC, lọc được theo `origin`).
 * Cách ly chi nhánh KGara ở mọi truy vấn. Bộ lọc/sắp xếp/tổng dùng util bảng chuẩn với whitelist cột EN.
 * Trang lấy bằng hai bước (id có sắp xếp, rồi entity) để sắp theo biểu thức SQL tùy ý vẫn đúng.
 */
@Injectable()
export class CaseListQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
    private readonly enrichment: CaseListEnrichmentService,
  ) {}

  async findPage(f: CaseListFilter): Promise<CaseListResponse> {
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );
    const qb = this.baseQuery(f);
    applyTableFilters(qb, parseListFilterPayload(f), CASE_COLUMNS, 'cf');
    applyCaseSpecialFilters(
      qb,
      parseFilterRecord<Record<string, string[]>>(f.column_filters),
    );
    applyTableSort(
      qb,
      f.sort,
      CASE_COLUMNS,
      { sql: '"c"."issued_at"', direction: 'DESC' },
      '"c"."id"',
    );

    const summaries = await applyListSummaries(qb, {
      columns: CASE_SUMMARY_KEYS.map((key) => ({
        key,
        sql: `COALESCE(${CASE_COLUMNS[key].sql}, 0)`,
      })),
      keys: parseSummaryKeys(f.summaryKeys),
      page,
      pageSize,
      tieBreaker: '"c"."id"',
    });
    const count = await qb
      .clone()
      .orderBy()
      .select('COUNT("c"."id")', 'total')
      .getRawOne<{ total: string }>();
    const idRows = await qb
      .select('"c"."id"', 'id')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ id: string }>();
    const ids = idRows.map((r) => r.id);
    const rows = ids.length
      ? await this.cases.find({ where: { id: In(ids) } })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((r): r is CaseGarage => !!r);

    const [sums, links, cats, gp] = await Promise.all([
      this.enrichment.settlementSums(ids),
      this.enrichment.linkCounts(ids),
      this.enrichment.categoryRefs(ordered.map((r) => r.categoryId)),
      this.enrichment.grossProfitByCase(ordered),
    ]);
    return {
      items: ordered.map((r) =>
        toCaseListItem(r, {
          settlement: sums.get(r.id),
          links: links.get(r.id),
          category: r.categoryId ? (cats.get(r.categoryId) ?? null) : null,
          grossProfit: gp.get(grossProfitKey(r.caseCode, r.branchExternalId)),
        }),
      ),
      pagination: buildPagination(page, pageSize, Number(count?.total) || 0),
      summaries,
    };
  }

  /** Truy vấn nền dùng chung với `column-options`. Có chọn chi nhánh ERP thì lọc theo `branch_id`. */
  baseQuery(
    f: Pick<
      CaseListFilter,
      'branchId' | 'from' | 'to' | 'origin' | 'search' | 'includeDeleted'
    >,
  ): SelectQueryBuilder<CaseGarage> {
    const qb = this.cases
      .createQueryBuilder('c')
      .leftJoin(ErpModuleCategory, 'cat', '"cat"."id" = "c"."category_id"')
      .where('"c"."is_deleted" = false');
    applyBranchScope(qb, 'c', f.branchId);
    if (!f.includeDeleted) qb.andWhere('"c"."external_deleted_at" IS NULL');
    if (f.origin) qb.andWhere('"c"."origin" = :origin', { origin: f.origin });
    if (f.from) {
      const v = vnDayBound(f.from, 'start');
      qb.andWhere('"c"."issued_at" >= :fromDate', { fromDate: v });
    }
    if (f.to) {
      const v = vnDayBound(f.to, 'end');
      qb.andWhere('"c"."issued_at" <= :toDate', { toDate: v });
    }
    const q = f.search?.trim();
    if (q) {
      qb.andWhere(
        new Brackets((b) => {
          SEARCH_COLUMNS.forEach((c, i) =>
            b[i === 0 ? 'where' : 'orWhere'](`"c"."${c}" ILIKE :q`, {
              q: `%${q}%`,
            }),
          );
        }),
      );
    }
    return qb;
  }
}
