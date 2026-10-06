import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import {
  GetInvoiceDebtsQueryDto,
  InvoicePartnerType,
} from '../../dto/get-invoice-debts.dto';
import { InvoiceDebtsQueryService } from './invoice-debts-query.service';
import {
  getDebtSummaryColumns,
  getDebtDetailColumns,
  initSheetStructure,
  finalizeSheetLayout,
  formatSummaryDataRow,
  formatDetailDataRow,
} from './invoice-debts-export-styles.helper';

@Injectable()
export class InvoiceDebtsExportService {
  constructor(
    private readonly debtsQueryService: InvoiceDebtsQueryService,
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Xuất file Excel báo cáo tổng hợp và chi tiết công nợ theo chuẩn ERP Spreadsheet
   */
  async exportDebtsExcel(
    queryDto: GetInvoiceDebtsQueryDto,
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.lastModifiedBy = 'Liouni ERP';
    workbook.created = new Date();

    const partnerType = queryDto.partner_type || InvoicePartnerType.CUSTOMER;
    const isSupplier = partnerType === InvoicePartnerType.SUPPLIER;
    const direction = isSupplier ? 'IN' : 'OUT';

    options?.onProgress?.(10, 100, 'Đang truy vấn dữ liệu công nợ...');

    // 1. Truy vấn danh sách tổng hợp công nợ (toàn bộ)
    const debtsResponse = await this.debtsQueryService.getDebts({
      ...queryDto,
      page: 1,
      pageSize: 100000,
    });
    const partners = debtsResponse.items || [];
    const summary = debtsResponse.summary;

    options?.onProgress?.(40, 100, 'Đang truy vấn chi tiết hóa đơn...');

    // 2. Truy vấn danh sách chi tiết hóa đơn (chỉ lấy hóa đơn của các đối tác đã lọc)
    const detailedInvoices = await this.fetchDetailedInvoices(
      direction,
      queryDto,
      partners,
    );

    options?.onProgress?.(65, 100, 'Đang khởi tạo các trang tính Excel...');

    // ── SHEET 1: TỔNG HỢP CÔNG NỢ & TUỔI NỢ ──────────────────────────────
    const sheet1Title = isSupplier
      ? 'Tổng hợp công nợ NCC'
      : 'Tổng hợp công nợ KH';
    const sheet1 = workbook.addWorksheet(sheet1Title);
    const sheet1Columns = getDebtSummaryColumns(isSupplier);

    initSheetStructure(sheet1, sheet1Columns);

    partners.forEach((p, idx) => {
      const row = sheet1.addRow([]);
      formatSummaryDataRow(row, p, idx);
    });

    const sheet1Sums: Record<string, number> = {
      invoiceCount: Number(summary.totalInvoiceCount) || 0,
      totalAmount: Number(summary.grandTotalAmount) || 0,
      paidAmount: Number(summary.grandTotalPaid) || 0,
      balanceAmount: Number(summary.grandTotalBalance) || 0,
      aging0To30: Number(summary.grandTotalAging0To30) || 0,
      aging31To60: Number(summary.grandTotalAging31To60) || 0,
      aging61To90: Number(summary.grandTotalAging61To90) || 0,
      agingOver90: Number(summary.grandTotalAgingOver90) || 0,
    };

    finalizeSheetLayout(sheet1, sheet1Columns, sheet1Sums, 2);

    // ── SHEET 2: CHI TIẾT HÓA ĐƠN ĐỐI TÁC ─────────────────────────────────
    options?.onProgress?.(85, 100, 'Đang điền chi tiết hóa đơn...');

    const sheet2 = workbook.addWorksheet('Chi tiết hóa đơn đối tác');
    const sheet2Columns = getDebtDetailColumns(isSupplier);

    initSheetStructure(sheet2, sheet2Columns);

    const sheet2Sums: Record<string, number> = {
      preVatAmount: 0,
      vatAmount: 0,
      totalAmount: 0,
      paidAmount: 0,
      balanceAmount: 0,
      aging0To30: 0,
      aging31To60: 0,
      aging61To90: 0,
      agingOver90: 0,
    };

    detailedInvoices.forEach((inv: any, idx: number) => {
      const row = sheet2.addRow([]);
      formatDetailDataRow(row, inv, idx, isSupplier);

      const bal = Number(inv.balanceAmount) || 0;
      const aging = Number(inv.agingDays) || 0;
      sheet2Sums.preVatAmount += Number(inv.preVatAmount) || 0;
      sheet2Sums.vatAmount += Number(inv.vatAmount) || 0;
      sheet2Sums.totalAmount += Number(inv.totalAmount) || 0;
      sheet2Sums.paidAmount += Number(inv.paidAmount) || 0;
      sheet2Sums.balanceAmount += bal;

      if (bal > 0) {
        if (aging <= 30) sheet2Sums.aging0To30 += bal;
        else if (aging <= 60) sheet2Sums.aging31To60 += bal;
        else if (aging <= 90) sheet2Sums.aging61To90 += bal;
        else sheet2Sums.agingOver90 += bal;
      }
    });

    finalizeSheetLayout(sheet2, sheet2Columns, sheet2Sums, 7);

    options?.onProgress?.(100, 100, 'Đang xuất tệp Excel hoàn chỉnh...');
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Truy vấn danh sách chi tiết hóa đơn của các đối tác đã lọc
   */
  private async fetchDetailedInvoices(
    direction: 'IN' | 'OUT',
    queryDto: GetInvoiceDebtsQueryDto,
    partners: any[],
  ): Promise<any[]> {
    if (!partners || partners.length === 0) {
      return [];
    }

    const partnerTaxExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')`;

    const rawPartnerNameExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')`;

    const validTaxCodes = Array.from(
      new Set(
        partners
          .map((p) => p.taxCode)
          .filter((tc) => tc && tc !== 'KHONG_MST' && tc !== '—'),
      ),
    );

    const noMstNames = Array.from(
      new Set(
        partners
          .filter(
            (p) => !p.taxCode || p.taxCode === 'KHONG_MST' || p.taxCode === '—',
          )
          .map((p) => p.partnerName)
          .filter((nm) => nm && nm !== '—'),
      ),
    );

    let detailedInvoicesQuery = `
      SELECT 
        inv.id,
        inv.invoice_no as "invoiceNo",
        inv.serial_no as "serialNo",
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
        inv.direction,
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') as "sellerName",
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST') as "sellerTaxCode",
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') as "buyerName",
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST') as "buyerTaxCode",
        inv.description,
        inv.status,
        inv.pre_vat_amount as "preVatAmount",
        inv.vat_amount as "vatAmount",
        inv.total_amount as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) as "balanceAmount",
        CASE 
          WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
          THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
          ELSE 0 
        END as "agingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = '${direction}'
    `;

    const partnerConditions: string[] = [];
    if (validTaxCodes.length > 0) {
      const inList = validTaxCodes
        .map((tc) => `'${tc.replace(/'/g, "''")}'`)
        .join(', ');
      partnerConditions.push(`${partnerTaxExpr} IN (${inList})`);
    }
    if (noMstNames.length > 0) {
      const inList = noMstNames
        .map((nm) => `'${nm.replace(/'/g, "''")}'`)
        .join(', ');
      partnerConditions.push(
        `(${rawPartnerNameExpr} IN (${inList}) AND ${partnerTaxExpr} = 'KHONG_MST')`,
      );
    }

    if (partnerConditions.length > 0) {
      detailedInvoicesQuery += ` AND (${partnerConditions.join(' OR ')})`;
    }

    if (queryDto.date_from) {
      detailedInvoicesQuery += ` AND inv.invoice_date >= '${queryDto.date_from.replace(/'/g, "''")}'`;
    }
    if (queryDto.date_to) {
      const effTo =
        queryDto.date_to.length === 10
          ? `${queryDto.date_to} 23:59:59.999`
          : queryDto.date_to;
      detailedInvoicesQuery += ` AND inv.invoice_date <= '${effTo.replace(/'/g, "''")}'`;
    }
    if (queryDto.branch_id) {
      if (queryDto.branch_id === 'null') {
        detailedInvoicesQuery += ` AND inv.branch_id IS NULL`;
      } else {
        detailedInvoicesQuery += ` AND inv.branch_id = '${queryDto.branch_id.replace(/'/g, "''")}'`;
      }
    }

    detailedInvoicesQuery += ` ORDER BY inv.invoice_date DESC, inv.invoice_no DESC`;

    return this.invoiceRepo.query(detailedInvoicesQuery);
  }
}
