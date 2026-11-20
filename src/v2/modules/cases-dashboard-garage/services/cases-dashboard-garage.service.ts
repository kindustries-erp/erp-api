import { Injectable } from '@nestjs/common';
import type {
  CaseDashboardClass,
  CaseDashboardFunnelDto,
  CaseDashboardOverviewDto,
  CaseDashboardPeriodKpis,
  CaseDashboardStage,
} from '../dto/case-dashboard.types';
import {
  parseDay,
  periodRangesFor,
  resolveDayRange,
} from '../helpers/case-dashboard-range';
import { CaseDashboardFunnelQueryService } from './case-dashboard-funnel-query.service';
import { CaseDashboardVehiclesQueryService } from './case-dashboard-vehicles-query.service';
import { CaseDashboardKpiQueryService } from './case-dashboard-kpi-query.service';

export interface CaseDashboardListInput {
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
    private readonly vehiclesQuery: CaseDashboardVehiclesQueryService,
  ) {}

  /** KPI tháng/tuần/ngày và dự thu, quanh ngày gốc (mặc định hôm nay). */
  getPeriodKpis(
    date?: string,
    now: Date = new Date(),
  ): Promise<CaseDashboardPeriodKpis> {
    return this.kpiQuery.getPeriodKpis(this.periodRanges(date, now));
  }

  /** Phễu theo khoảng ngày (mặc định tháng hiện tại). */
  getFunnel(
    dateFrom?: string,
    dateTo?: string,
    now: Date = new Date(),
  ): Promise<CaseDashboardFunnelDto> {
    return this.funnelQuery.getFunnel(resolveDayRange(dateFrom, dateTo, now));
  }

  /**
   * KPI kỳ và phễu trong một lần gọi. Hai phần độc lập nên chạy song song; dữ liệu không đổi
   * khi người dùng đổi trang hay giai đoạn của danh sách xe nên tách khỏi `listVehicles`.
   */
  async getOverview(
    date?: string,
    dateFrom?: string,
    dateTo?: string,
    now: Date = new Date(),
  ): Promise<CaseDashboardOverviewDto> {
    // Kiểm tra cả hai nhóm tham số trước khi chạy truy vấn: tham số sai thì không truy vấn nào được khởi động.
    const periodRanges = this.periodRanges(date, now);
    const funnelRange = resolveDayRange(dateFrom, dateTo, now);
    const [period, funnel] = await Promise.all([
      this.kpiQuery.getPeriodKpis(periodRanges),
      this.funnelQuery.getFunnel(funnelRange),
    ]);
    return { period, funnel };
  }

  /** Danh sách xe (drill-down): mỗi dòng một xe kèm các lệnh, phân trang và tổng theo xe (mặc định trang 1, 20 dòng). */
  listVehicles(input: CaseDashboardListInput, now: Date = new Date()) {
    return this.vehiclesQuery.listVehicles(this.toDrillParams(input, now));
  }

  private periodRanges(date: string | undefined, now: Date) {
    return periodRangesFor(date ? parseDay(date, 'date') : now);
  }

  private toDrillParams(input: CaseDashboardListInput, now: Date) {
    return {
      range: resolveDayRange(input.dateFrom, input.dateTo, now),
      stage: input.stage,
      classification: input.classification,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    };
  }
}
