import { Injectable } from '@nestjs/common';
import type {
  CaseDashboardClass,
  CaseDashboardFunnelDto,
  CaseDashboardStage,
} from '../dto/case-dashboard.types';
import {
  parseDay,
  periodRangesFor,
  resolveDayRange,
} from '../helpers/case-dashboard-range';
import { CaseDashboardCasesQueryService } from './case-dashboard-cases-query.service';
import { CaseDashboardFunnelQueryService } from './case-dashboard-funnel-query.service';
import { CaseDashboardVehiclesQueryService } from './case-dashboard-vehicles-query.service';
import {
  CaseDashboardKpiQueryService,
  type CaseDashboardPeriodKpis,
} from './case-dashboard-kpi-query.service';

export interface CaseDashboardCasesInput {
  dateFrom?: string;
  dateTo?: string;
  stage?: CaseDashboardStage;
  classification?: CaseDashboardClass;
  page?: number;
  pageSize?: number;
}

/**
 * Facade dashboard garage V2: quy đổi tham số HTTP thành khoảng thời gian rồi gọi các query service.
 * Không chứa SQL. `now` được truyền vào để kiểm thử cố định thời điểm.
 */
@Injectable()
export class CasesDashboardGarageService {
  constructor(
    private readonly kpiQuery: CaseDashboardKpiQueryService,
    private readonly funnelQuery: CaseDashboardFunnelQueryService,
    private readonly casesQuery: CaseDashboardCasesQueryService,
    private readonly vehiclesQuery: CaseDashboardVehiclesQueryService,
  ) {}

  /** KPI tháng/tuần/ngày và dự thu, quanh ngày gốc (mặc định hôm nay). */
  getPeriodKpis(
    date?: string,
    now: Date = new Date(),
  ): Promise<CaseDashboardPeriodKpis> {
    const base = date ? parseDay(date, 'date') : now;
    return this.kpiQuery.getPeriodKpis(periodRangesFor(base));
  }

  /** Phễu theo khoảng ngày (mặc định tháng hiện tại). */
  getFunnel(
    dateFrom?: string,
    dateTo?: string,
    now: Date = new Date(),
  ): Promise<CaseDashboardFunnelDto> {
    return this.funnelQuery.getFunnel(resolveDayRange(dateFrom, dateTo, now));
  }

  /** Drill-down danh sách lệnh, phân trang (mặc định trang 1, 20 dòng). */
  listCases(input: CaseDashboardCasesInput, now: Date = new Date()) {
    return this.casesQuery.listCases(this.toDrillParams(input, now));
  }

  /** Drill-down theo xe: mỗi dòng một xe kèm các lệnh, phân trang và tổng theo xe. */
  listVehicles(input: CaseDashboardCasesInput, now: Date = new Date()) {
    return this.vehiclesQuery.listVehicles(this.toDrillParams(input, now));
  }

  private toDrillParams(input: CaseDashboardCasesInput, now: Date) {
    return {
      range: resolveDayRange(input.dateFrom, input.dateTo, now),
      stage: input.stage,
      classification: input.classification,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    };
  }
}
