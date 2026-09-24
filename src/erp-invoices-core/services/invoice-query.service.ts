import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import { ErpInvoiceItem } from '../entities/erp_invoice_item.entity';
import { ErpEntityAttributeValue } from '../../module-config/entities/erp_entity_attribute_value.entity';
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

  private readonly listQueryService: InvoiceListQueryService;
  private readonly exportExcelService: InvoiceExportExcelService;
  private readonly statsService: InvoiceStatsService;
  private readonly itemsQueryService: InvoiceItemsQueryService;
  private readonly itemsExportService: InvoiceItemsExportService;

  constructor(
    listQueryService: InvoiceListQueryService,
    exportExcelService: InvoiceExportExcelService,
    statsService: InvoiceStatsService,
    itemsQueryService: InvoiceItemsQueryService,
    itemsExportService: InvoiceItemsExportService,
  );
  constructor(
    repository: Repository<ErpInvoice>,
    attributeValueRepository?: Repository<ErpEntityAttributeValue>,
    itemRepository?: Repository<ErpInvoiceItem>,
  );
  constructor(
    arg1: InvoiceListQueryService | Repository<ErpInvoice>,
    arg2?: InvoiceExportExcelService | Repository<ErpEntityAttributeValue>,
    arg3?: InvoiceStatsService | Repository<ErpInvoiceItem>,
    arg4?: InvoiceItemsQueryService,
    arg5?: InvoiceItemsExportService,
  ) {
    if (arg1 instanceof InvoiceListQueryService) {
      this.listQueryService = arg1;
      this.exportExcelService = arg2 as InvoiceExportExcelService;
      this.statsService = arg3 as InvoiceStatsService;
      this.itemsQueryService = arg4 as InvoiceItemsQueryService;
      this.itemsExportService = arg5 as InvoiceItemsExportService;
    } else {
      // Fallback cho constructor truyền trực tiếp Repository (tương thích 100% test mocks cũ)
      const repo = arg1 as Repository<ErpInvoice>;
      const attrRepo = arg2 as Repository<ErpEntityAttributeValue>;
      const itemRepo = arg3 as Repository<ErpInvoiceItem>;

      this.listQueryService = new InvoiceListQueryService(repo, attrRepo);
      this.exportExcelService = new InvoiceExportExcelService(repo);
      this.statsService = new InvoiceStatsService(repo);
      this.itemsQueryService = new InvoiceItemsQueryService(repo, itemRepo);
      this.itemsExportService = new InvoiceItemsExportService(
        this.itemsQueryService,
      );
    }
  }

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
