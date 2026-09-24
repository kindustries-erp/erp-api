import { Injectable, Logger } from '@nestjs/common';
import { GarageDashboardStatsService } from './services/garage-dashboard-stats.service';
import { GarageCheckpointService } from './services/garage-checkpoint.service';
import { GarageCustomerStatsService } from './services/garage-customer-stats.service';
import { GarageDashboardExportService } from './services/garage-dashboard-export.service';
import { GaragePnlService } from './services/garage-pnl.service';
import { ListGarageOpexQueryDto } from './dto/garage-opex.dto';

@Injectable()
export class GarageDashboardService {
  private readonly logger = new Logger(GarageDashboardService.name);

  constructor(
    private readonly statsService: GarageDashboardStatsService,
    private readonly checkpointService: GarageCheckpointService,
    private readonly customerStatsService: GarageCustomerStatsService,
    private readonly exportService: GarageDashboardExportService,
    private readonly pnlService: GaragePnlService,
  ) {}

  /**
   * 1. Lấy biểu đồ xu hướng theo tháng (Doanh thu, Giá vốn, Lợi nhuận gộp, Tiến độ thu tiền, Tiến độ trả tiền & Phân bổ trạng thái theo từng tháng)
   */
  getDashboardStats(dateFrom?: string, dateTo?: string) {
    return this.statsService.getDashboardStats(dateFrom, dateTo);
  }

  /**
   * 2. Lấy chỉ số KPI Checkpoints (Tháng này / Tuần này / Hôm nay) kèm Sparklines theo Ngày hoàn thành & Dự thu Pipeline xe đang làm
   */
  getCheckpointKpis() {
    return this.checkpointService.getCheckpointKpis();
  }

  /**
   * 3. Lấy danh sách vụ việc trong khoảng thời gian checkpoint (click sparkline / mở drawer)
   */
  getCheckpointCases(
    dateFrom: string,
    dateTo: string,
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    paymentStatus?: 'all' | 'remaining' | 'paid' | 'unpaid',
    classification?: string,
    sortBy: string = 'ngayHoanThanhCongViec',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    return this.checkpointService.getCheckpointCases(
      dateFrom,
      dateTo,
      page,
      pageSize,
      search,
      paymentStatus,
      classification,
      sortBy,
      sortOrder,
    );
  }

  /**
   * 4. Lấy danh sách khách hàng và công nợ (Customer Stats & Debt) theo Ngày hoàn thành
   */
  getCustomersStats(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
    columnSearch?: string,
    columnFilters?: string,
  ) {
    return this.customerStatsService.getCustomersStats(
      page,
      pageSize,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      columnSearch,
      columnFilters,
    );
  }

  /**
   * 5. Xuất báo cáo Excel chuyên nghiệp đa bảng (Multi-sheet Export) theo Ngày hoàn thành
   */
  exportExcel(dateFrom?: string, dateTo?: string): Promise<Buffer> {
    return this.exportService.exportExcel(dateFrom, dateTo);
  }

  /**
   * 6. Lấy Báo cáo Lợi nhuận (P&L) Garage theo tháng (Doanh thu + Giá vốn + CP vận hành + Hoa hồng -> Lợi nhuận ròng)
   */
  getPnlReport(year?: number, month?: number) {
    return this.pnlService.getPnlReport(year, month);
  }

  /**
   * Lấy danh sách CP Vận hành kết hợp (kèm 2 dòng Hoa hồng Sale & DV tính toán tự động)
   */
  getCombinedOpexList(query: ListGarageOpexQueryDto) {
    return this.pnlService.getCombinedOpexList(query);
  }

  /**
   * Lấy chi tiết bản ghi ảo hoa hồng tự động
   */
  getVirtualOpexById(id: string) {
    return this.pnlService.getVirtualOpexById(id);
  }

  /**
   * 7. Xuất Báo cáo Lợi nhuận (P&L) ra file Excel
   */
  exportPnlExcel(year?: number, month?: number): Promise<Buffer> {
    return this.pnlService.exportPnlExcel(year, month);
  }
}
