import { Injectable } from '@nestjs/common';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';
import { InvoiceListQueryService } from './sub-services/invoice-list-query.service';
import { InvoiceExportExcelService } from './sub-services/invoice-export-excel.service';
import { InvoiceStatsService } from './sub-services/invoice-stats.service';
import {
  InvoiceItemsQueryService,
  ErpInvoiceItemQuery,
} from './sub-services/invoice-items-query.service';
import { InvoiceItemsExportService } from './sub-services/invoice-items-export.service';
import { getExcelColumnLetter } from './sub-services/invoice-query-helpers';

export { getExcelColumnLetter };
export type { ErpInvoiceItemQuery };

/**
 * InvoiceQueryService (Facade)
 * Điều phối các sub-services chuyên biệt:
 * - InvoiceListQueryService: Truy vấn danh sách hóa đơn & Column Options
 * - InvoiceExportExcelService: Xuất báo cáo Excel hóa đơn đa Sheet
 * - InvoiceStatsService: Thống kê doanh thu, thuế & Bulk Net-Offs
 * - InvoiceItemsQueryService: Truy vấn danh sách dòng hàng hóa (Invoice Items) & Column Options
 * - InvoiceItemsExportService: Xuất Excel chi tiết dòng hàng hóa
 */
@Injectable()
export class InvoiceQueryService {
  public static readonly EXPORT_PROGRESS_TOTAL_UNITS =
    InvoiceExportExcelService.EXPORT_PROGRESS_TOTAL_UNITS;

  constructor(
    private readonly listQueryService: InvoiceListQueryService,
    private readonly exportExcelService: InvoiceExportExcelService,
    private readonly statsService: InvoiceStatsService,
    private readonly itemsQueryService: InvoiceItemsQueryService,
    private readonly itemsExportService: InvoiceItemsExportService,
  ) {}

  /**
   * Column options for advanced filter UI
   */
  async getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    return this.listQueryService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
      direction,
    );
  }

  /**
   * Find all with pagination, sort, filter
   */
  async findAll(query: ErpInvoiceQuery) {
    return this.listQueryService.findAll(query);
  }

  /**
   * Excel export — replicates findAll filter logic then writes spreadsheet
   */
  async exportExcel(
    query: ErpInvoiceQuery,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    return this.exportExcelService.exportExcel(query, options);
  }

  /**
   * Truy vấn thông tin cấn trừ hàng loạt của danh sách hóa đơn
   */
  async getBulkNetOffs(invoiceIds: string[]) {
    return this.statsService.getBulkNetOffs(invoiceIds);
  }

  /**
   * Thống kê KPI doanh thu / chi phí hóa đơn theo ngày, tuần, tháng và chi nhánh
   */
  async getStats(direction?: 'IN' | 'OUT', dateFrom?: string, dateTo?: string) {
    return this.statsService.getStats(direction, dateFrom, dateTo);
  }

  /**
   * Truy vấn danh sách phân rã dòng hàng hóa (Invoice Items)
   */
  async findAllItems(query: ErpInvoiceItemQuery) {
    return this.itemsQueryService.findAllItems(query);
  }

  /**
   * Column options cho bảng phân rã dòng hàng hóa
   */
  async getItemColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    return this.itemsQueryService.getItemColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
      direction,
    );
  }

  /**
   * Xuất file Excel danh sách chi tiết các dòng hàng hóa
   */
  async exportItemsExcel(query: ErpInvoiceItemQuery): Promise<Buffer> {
    return this.itemsExportService.exportItemsExcel(query);
  }
}
