import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toPagedList } from '@/common/utils/paginated-result';
import { CaseGarage } from '../../cases-garage/entities/case-garage.entity';
import type {
  CaseDashboardCaseItemDto,
  CaseDashboardClass,
  CaseDashboardStage,
} from '../dto/case-dashboard.types';
import { CASE_DASHBOARD_STAGE_STATUS } from '../dto/case-dashboard.types';
import { toCaseDashboardItemDto } from '../helpers/case-dashboard.mapper';
import {
  BASE_FILTER,
  CLASS_SQL,
  PERIOD_DATE,
} from '../helpers/case-dashboard.sql';
import type { CaseDashboardDateRange } from './case-dashboard-kpi-query.service';

export interface CaseDashboardCasesParams {
  range: CaseDashboardDateRange;
  stage?: CaseDashboardStage;
  classification?: CaseDashboardClass;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Chuẩn hóa phân trang: trang >= 1, cỡ trang trong [1, 100]. */
export function normalizePaging(page: number, pageSize: number) {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const raw = Number.isFinite(pageSize)
    ? Math.floor(pageSize)
    : DEFAULT_PAGE_SIZE;
  const safeSize = Math.min(Math.max(raw, 1), MAX_PAGE_SIZE);
  return { page: safePage, pageSize: safeSize };
}

/**
 * Drill-down danh sách lệnh của dashboard garage V2 (đọc `cases_garage`).
 * Mỗi dòng là MỘT lệnh; dòng cùng biển số là cùng một xe (khóa xe trả về trong `vehicleKey`).
 * Chỉ đọc, không ghi.
 */
@Injectable()
export class CaseDashboardCasesQueryService {
  constructor(
    @InjectRepository(CaseGarage)
    private readonly cases: Repository<CaseGarage>,
  ) {}

  async listCases(
    params: CaseDashboardCasesParams,
  ): Promise<ReturnType<typeof toPagedList<CaseDashboardCaseItemDto>>> {
    const { page, pageSize } = normalizePaging(params.page, params.pageSize);
    const qb = this.cases
      .createQueryBuilder('c')
      .where(BASE_FILTER)
      .andWhere(`${PERIOD_DATE} >= :start AND ${PERIOD_DATE} <= :end`, {
        start: params.range.start,
        end: params.range.end,
      });

    if (params.stage) {
      qb.andWhere('c.status = :status', {
        status: CASE_DASHBOARD_STAGE_STATUS[params.stage],
      });
    }
    if (params.classification) {
      qb.andWhere(CLASS_SQL[params.classification]);
    }

    // Không dùng skip/take: không có join nên offset/limit an toàn và tránh subquery DISTINCT.
    qb.orderBy(PERIOD_DATE, 'DESC')
      .addOrderBy('c.id', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    const items = rows.map((row) => toCaseDashboardItemDto(row));
    return toPagedList(items, page, pageSize, total);
  }
}
