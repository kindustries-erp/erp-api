import { Injectable } from '@nestjs/common';
import {
  GetInvoiceDebtsQueryDto,
  GetInvoiceDebtColumnOptionsQueryDto,
  InvoicePartnerType,
} from '../dto/get-invoice-debts.dto';
import { InvoiceDebtsQueryService } from './sub-services/invoice-debts-query.service';
import { InvoiceDebtsDetailService } from './sub-services/invoice-debts-detail.service';
import { InvoiceDebtsExportService } from './sub-services/invoice-debts-export.service';

export interface InvoiceDebtItem {
  taxCode: string;
  partnerName: string;
  address?: string;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  maxAgingDays: number;
  weightedAgingDays: number;
  latestInvoiceDate: string | null;
  // Aging Buckets breakdown
  aging0To30: number;
  aging31To60: number;
  aging61To90: number;
  agingOver90: number;
  count0To30: number;
  count31To60: number;
  count61To90: number;
  countOver90: number;
}

export interface InvoiceDebtSummary {
  totalPartners: number;
  totalInvoiceCount: number;
  grandTotalAmount: number;
  grandTotalPaid: number;
  grandTotalBalance: number;
  // Grand totals for aging buckets
  grandTotalAging0To30?: number;
  grandTotalAging31To60?: number;
  grandTotalAging61To90?: number;
  grandTotalAgingOver90?: number;
  cumulativeTotalAmount?: number;
  cumulativePaidAmount?: number;
  cumulativeBalanceAmount?: number;
  cumulativeInvoiceCount?: number;
  cumulativePartnersCount?: number;
  cumulativeAging0To30?: number;
  cumulativeAging31To60?: number;
  cumulativeAging61To90?: number;
  cumulativeAgingOver90?: number;
}

export interface InvoiceDebtsResponse {
  items: InvoiceDebtItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: InvoiceDebtSummary;
}

export interface ColumnOptionItem {
  label: string;
  value: string;
}

export interface ColumnOptionsResponse {
  items: ColumnOptionItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  next: number | null;
}

/**
 * InvoiceDebtsService (Facade)
 * Điều phối các sub-services chuyên biệt:
 * - InvoiceDebtsQueryService: Truy vấn danh sách công nợ & column options
 * - InvoiceDebtsDetailService: Chi tiết hóa đơn đối tác
 * - InvoiceDebtsExportService: Xuất báo cáo Excel công nợ & tuổi nợ
 */
@Injectable()
export class InvoiceDebtsService {
  constructor(
    private readonly debtsQueryService: InvoiceDebtsQueryService,
    private readonly debtsDetailService: InvoiceDebtsDetailService,
    private readonly debtsExportService: InvoiceDebtsExportService,
  ) {}

  /**
   * Truy vấn danh sách tổng hợp công nợ Khách hàng hoặc Nhà cung cấp
   */
  async getDebts(
    queryDto: GetInvoiceDebtsQueryDto,
  ): Promise<InvoiceDebtsResponse> {
    return this.debtsQueryService.getDebts(queryDto);
  }

  /**
   * Lấy danh sách options phục vụ Server-side dropdown filter cho từng cột
   */
  async getColumnOptions(
    queryDto: GetInvoiceDebtColumnOptionsQueryDto,
  ): Promise<ColumnOptionsResponse> {
    return this.debtsQueryService.getColumnOptions(queryDto);
  }

  /**
   * Lấy danh sách hóa đơn chi tiết của một đối tác cụ thể
   */
  async getPartnerInvoices(
    taxCode: string,
    partnerType?: InvoicePartnerType,
    dateFrom?: string,
    dateTo?: string,
    partnerName?: string,
  ) {
    return this.debtsDetailService.getPartnerInvoices(
      taxCode,
      partnerType,
      dateFrom,
      dateTo,
      partnerName,
    );
  }

  /**
   * Xuất file Excel báo cáo tổng hợp và chi tiết công nợ
   */
  async exportDebtsExcel(
    queryDto: GetInvoiceDebtsQueryDto,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    return this.debtsExportService.exportDebtsExcel(queryDto, options);
  }
}
