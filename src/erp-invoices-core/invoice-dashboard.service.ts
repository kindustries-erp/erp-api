import { Injectable } from '@nestjs/common';
import {
  InvoiceDashboardStatsService,
  DashboardStatsResponse,
} from './services/sub-services/invoice-dashboard-stats.service';
import {
  InvoiceDashboardPartnersService,
  DashboardPartnersResponse,
} from './services/sub-services/invoice-dashboard-partners.service';
import {
  InvoiceDashboardExportService,
  DetailedInvoiceItem,
} from './services/sub-services/invoice-dashboard-export.service';
import {
  InvoiceDashboardAnalyticsService,
  DebtsAnalyticsResponse,
} from './services/sub-services/invoice-dashboard-analytics.service';
import {
  InvoiceDashboardHorizonService,
  GetTimeHorizonInvoicesQuery,
  TimeHorizonInvoicesResponse,
} from './services/sub-services/invoice-dashboard-horizon.service';

export type {
  DashboardStatsResponse,
  DashboardPartnersResponse,
  DetailedInvoiceItem,
  DebtsAnalyticsResponse,
  GetTimeHorizonInvoicesQuery,
  TimeHorizonInvoicesResponse,
};

/**
 * InvoiceDashboardService (Facade Pattern)
 *
 * Điều phối các sub-services chuyên biệt:
 * - InvoiceDashboardStatsService: Thống kê xu hướng doanh thu / chi phí & VAT theo tháng
 * - InvoiceDashboardPartnersService: Báo cáo & phân trang công nợ đối tác hóa đơn
 * - InvoiceDashboardExportService: Xuất báo cáo Excel 5 Worksheets & danh sách chi tiết hóa đơn
 * - InvoiceDashboardAnalyticsService: Phân tích tài chính công nợ, phân tầng tuổi nợ và IFRS 9 ECL
 * - InvoiceDashboardHorizonService: Chi tiết hóa đơn theo từng mốc chân trời thời gian & phân rã đa chiều
 */
@Injectable()
export class InvoiceDashboardService {
  constructor(
    private readonly statsService: InvoiceDashboardStatsService,
    private readonly partnersService: InvoiceDashboardPartnersService,
    private readonly exportService: InvoiceDashboardExportService,
    private readonly analyticsService: InvoiceDashboardAnalyticsService,
    private readonly horizonService: InvoiceDashboardHorizonService,
  ) {}

  /**
   * Thống kê biểu đồ xu hướng dòng tiền & VAT theo tháng
   */
  async getDashboardStats(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DashboardStatsResponse> {
    return this.statsService.getDashboardStats(dateFrom, dateTo, branchId);
  }

  /**
   * Truy vấn danh sách phân trang tổng hợp doanh thu/chi phí và công nợ phải thu/phải trả theo đối tác
   */
  async getDashboardPartners(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
    columnSearch?: string,
    columnFilters?: string,
  ): Promise<DashboardPartnersResponse> {
    return this.partnersService.getDashboardPartners(
      page,
      pageSize,
      search,
      dateFrom,
      dateTo,
      branchId,
      sortBy,
      sortOrder,
      columnSearch,
      columnFilters,
    );
  }

  /**
   * Thống kê xu hướng thu / chi theo tháng của riêng một mã số thuế đối tác cụ thể
   */
  async getPartnerStats(
    taxCode: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<DashboardStatsResponse> {
    return this.statsService.getPartnerStats(taxCode, dateFrom, dateTo);
  }

  /**
   * Truy vấn danh sách chi tiết từng hóa đơn kèm số tiền đã cấn trừ và còn lại
   */
  async getDetailedInvoices(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DetailedInvoiceItem[]> {
    return this.exportService.getDetailedInvoices(dateFrom, dateTo, branchId);
  }

  /**
   * Xuất báo cáo Excel 5 Worksheets chuyên nghiệp
   */
  async exportExcel(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<Buffer> {
    return this.exportService.exportExcel(dateFrom, dateTo, branchId);
  }

  /**
   * Tổng quan phân tích công nợ, phân tầng tuổi nợ và các chân trời dự báo dòng tiền IFRS 9 ECL
   */
  async getDebtsAnalytics(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DebtsAnalyticsResponse> {
    return this.analyticsService.getDebtsAnalytics(dateFrom, dateTo, branchId);
  }

  /**
   * Lấy danh sách chi tiết hóa đơn theo từng Mốc thời gian (Time Horizon & Forecast Horizon)
   */
  async getTimeHorizonInvoices(
    horizon: string,
    query: GetTimeHorizonInvoicesQuery,
  ): Promise<TimeHorizonInvoicesResponse> {
    return this.horizonService.getTimeHorizonInvoices(horizon, query);
  }
}
