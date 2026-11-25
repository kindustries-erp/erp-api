import { Injectable } from '@nestjs/common';
import { vnDayBound } from '@/v2/core/base-core/helpers/vn-time.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { applyBranchScope } from '@/v2/core/branches-core';
import { buildPagination } from '@/common/utils/paginated-result';
import {
  applyListSummaries,
  applyTableFilters,
  applyTableSort,
  parseListFilterPayload,
  parseSummaryKeys,
} from '@/common/utils/table-query';
import { KgaraBranch } from '@/kgara-api-core/entities/kgara_branch.entity';
import type { CaseServicesResponse } from '../dto/case-service-row.types';
import { CaseGarage } from '../entities/case-garage.entity';
import type { CaseOrigin } from '../entities/case-garage.enums';
import { CaseLineGarage } from '../entities/case-line-garage.entity';
import {
  SERVICE_COLUMNS,
  SERVICE_SUMMARY_COLUMNS,
} from '../helpers/case-query.columns';
import {
  CASE_SERVICE_SELECT,
  toCaseServiceRow,
} from '../helpers/case-service-row.mapper';

export interface CaseServicesFilter {
  /** Chi nhánh ERP (không bắt buộc); không có thì mọi chi nhánh. */
  branchId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  /** Ngày tiếp nhận (hoặc phát sinh) từ/đến. */
  from?: string;
  to?: string;
  serviceType?: string;
  origin?: CaseOrigin;
  column_filters?: string;
  column_search?: string;
  column_operators?: string;
  date_ranges?: string;
  /** `a,-b`: dấu `-` là giảm dần. */
  sort?: string;
  summaryKeys?: string;
}

const SEARCH_COLUMNS = [
  's.product_code',
  's.product_name',
  's.description',
  'c.case_code',
  'c.license_plate',
  'c.customer_name',
  'c.customer_code',
];

/**
 * Hạng mục dịch vụ và phụ tùng của vụ việc v2 (nguồn `case_lines_garage` + `cases_garage`), cả NATIVE
 * lẫn KGARA_SYNC, lọc được theo `origin`. Chỉ vụ việc/dòng còn hiệu lực. Join chi nhánh KGara đủ
 * `account_key` để không nhân đôi dòng. Tổng bằng SQL qua `applyListSummaries`.
 */
@Injectable()
export class CaseServicesQueryService {
  constructor(
    @InjectRepository(CaseLineGarage)
    private readonly services: Repository<CaseLineGarage>,
  ) {}

  async findPage(f: CaseServicesFilter): Promise<CaseServicesResponse> {
    const page = Math.max(1, Math.floor(f.page ?? 1) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, Math.floor(f.pageSize ?? 20) || 20),
    );
    const qb = this.baseQuery(f);
    applyTableFilters(qb, parseListFilterPayload(f), SERVICE_COLUMNS, 'sf');
    applyTableSort(
      qb,
      f.sort,
      SERVICE_COLUMNS,
      {
        sql: 'COALESCE("c"."received_at", "c"."issued_at")',
        direction: 'DESC',
      },
      '"s"."id"',
    );
    const summaries = await applyListSummaries(qb, {
      columns: SERVICE_SUMMARY_COLUMNS,
      keys: parseSummaryKeys(f.summaryKeys),
      page,
      pageSize,
      tieBreaker: '"s"."id"',
    });
    const count = await qb
      .clone()
      .orderBy()
      .select('COUNT("s"."id")', 'total')
      .getRawOne<{ total: string }>();
    const rows = await qb
      .select(CASE_SERVICE_SELECT)
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<Record<string, unknown>>();
    return {
      items: rows.map(toCaseServiceRow),
      pagination: buildPagination(page, pageSize, Number(count?.total) || 0),
      summaries,
    };
  }

  private baseQuery(f: CaseServicesFilter): SelectQueryBuilder<CaseLineGarage> {
    const qb = this.services
      .createQueryBuilder('s')
      .innerJoin(CaseGarage, 'c', '"c"."id" = "s"."case_id"')
      // Một `external_id` có một dòng chi nhánh cho mỗi `account_key` (MAIN, OJ): join đủ hai cột.
      .leftJoin(
        KgaraBranch,
        'b',
        'b.external_id = c.branch_external_id AND b.account_key = c.account_key',
      )
      .where('"c"."is_deleted" = false')
      .andWhere('"c"."external_deleted_at" IS NULL')
      .andWhere('"s"."external_deleted_at" IS NULL')
      .andWhere(`NOT jsonb_exists("s"."overrides", '_deleted')`);
    applyBranchScope(qb, 'c', f.branchId);
    if (f.origin) qb.andWhere('"c"."origin" = :origin', { origin: f.origin });
    if (f.serviceType && f.serviceType !== 'ALL') {
      qb.andWhere('"s"."product_type_code" = :serviceType', {
        serviceType: f.serviceType,
      });
    }
    const dateExpr = 'COALESCE("c"."received_at", "c"."issued_at")';
    if (f.from) {
      const v = vnDayBound(f.from, 'start');
      qb.andWhere(`${dateExpr} >= :fromDate`, { fromDate: v });
    }
    if (f.to) {
      const v = vnDayBound(f.to, 'end');
      qb.andWhere(`${dateExpr} <= :toDate`, { toDate: v });
    }
    const q = f.search?.trim();
    if (q) {
      qb.andWhere(
        new Brackets((sub) => {
          SEARCH_COLUMNS.forEach((col, i) => {
            const [a, c] = col.split('.');
            sub[i === 0 ? 'where' : 'orWhere'](`"${a}"."${c}" ILIKE :q`, {
              q: `%${q}%`,
            });
          });
        }),
      );
    }
    return qb;
  }
}
