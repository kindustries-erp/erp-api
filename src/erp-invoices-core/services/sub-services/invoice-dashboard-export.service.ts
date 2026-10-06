import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { InvoiceDashboardStatsService } from './invoice-dashboard-stats.service';
import { InvoiceDashboardPartnersService } from './invoice-dashboard-partners.service';
import {
  getExcelColLetter,
  normalizeEffectiveDateTo,
} from './invoice-dashboard-helpers';

export interface DetailedInvoiceItem {
  invoiceNo: string;
  serialNo: string;
  invoiceDate: string;
  direction: 'IN' | 'OUT';
  sellerName: string;
  sellerTaxCode: string;
  buyerName: string;
  buyerTaxCode: string;
  preVatAmount: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

@Injectable()
export class InvoiceDashboardExportService {
  private readonly logger = new Logger(InvoiceDashboardExportService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    private readonly statsService: InvoiceDashboardStatsService,
    private readonly partnersService: InvoiceDashboardPartnersService,
  ) {}

  /**
   * Truy vấn danh sách chi tiết từng hóa đơn kèm số tiền đã cấn trừ và còn lại
   */
  async getDetailedInvoices(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<DetailedInvoiceItem[]> {
    const effectiveDateTo = normalizeEffectiveDateTo(dateTo);

    let query = `
      SELECT 
        inv.invoice_no as "invoiceNo",
        inv.serial_no as "serialNo",
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
        inv.direction,
        inv.seller_name as "sellerName",
        inv.seller_tax_code as "sellerTaxCode",
        inv.buyer_name as "buyerName",
        inv.buyer_tax_code as "buyerTaxCode",
        CAST(inv.pre_vat_amount AS NUMERIC) as "preVatAmount",
        CAST(inv.vat_amount AS NUMERIC) as "vatAmount",
        CAST(inv.total_amount AS NUMERIC) as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        inv.status
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
    `;

    const whereConditions: string[] = [];
    if (dateFrom) {
      whereConditions.push(`inv.invoice_date >= '${dateFrom}'`);
    }
    if (effectiveDateTo) {
      whereConditions.push(`inv.invoice_date <= '${effectiveDateTo}'`);
    }
    if (branchId) {
      if (branchId === 'null') {
        whereConditions.push(`inv.branch_id IS NULL`);
      } else {
        whereConditions.push(`inv.branch_id = '${branchId}'`);
      }
    }

    if (whereConditions.length > 0) {
      query += ` AND ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY inv.invoice_date DESC`;

    const rawData = await this.invoiceRepo.query(query);

    return rawData.map((r: any) => {
      const totalAmount = Number(r.totalAmount) || 0;
      const paidAmount = Number(r.paidAmount) || 0;
      const preVatAmount = Number(r.preVatAmount) || 0;
      const vatAmount = Number(r.vatAmount) || 0;

      return {
        invoiceNo: r.invoiceNo,
        serialNo: r.serialNo,
        invoiceDate: r.invoiceDate,
        direction: r.direction,
        sellerName: r.sellerName,
        sellerTaxCode: r.sellerTaxCode,
        buyerName: r.buyerName,
        buyerTaxCode: r.buyerTaxCode,
        preVatAmount,
        vatAmount,
        totalAmount,
        paidAmount,
        remainingAmount:
          totalAmount > paidAmount ? totalAmount - paidAmount : 0,
        status: r.status,
      };
    });
  }

  /**
   * Xuất báo cáo Excel 5 Worksheets chuyên nghiệp
   */
  async exportExcel(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin' as const, color: { argb: 'FFE2E8F0' } },
    };

    const initSheet = (
      sheet: ExcelJS.Worksheet,
      columns: Array<{ key: string; width?: number }>,
    ) => {
      sheet.columns = columns.map((c) => ({ key: c.key, width: c.width }));
      sheet.addRow([]);
      sheet.addRow([]);
      sheet.addRow([]);
      sheet.addRow([]);
    };

    const finalizeSheet = (
      sheet: ExcelJS.Worksheet,
      columns: Array<{
        header: string;
        key: string;
        width: number;
        style?: { numFmt?: string };
        isSum?: boolean;
      }>,
      calculatedSums: Record<string, number>,
      labelColIndex = 1,
    ) => {
      const totalCols = columns.length;
      const startRow = 5;
      const endRow = Math.max(startRow, sheet.rowCount);

      const sumRow = sheet.getRow(1);
      sumRow.height = 22;
      sumRow.font = {
        name: 'Calibri',
        size: 10.5,
        bold: true,
        color: { argb: 'FF0F172A' },
      };

      const subtotalRow = sheet.getRow(2);
      subtotalRow.height = 22;
      subtotalRow.font = {
        name: 'Calibri',
        size: 10.5,
        bold: true,
        color: { argb: 'FF1E40AF' },
      };

      const blankRow = sheet.getRow(3);
      blankRow.height = 10;

      const headerRow = sheet.getRow(4);
      headerRow.height = 28;
      headerRow.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      headerRow.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };

      for (let c = 1; c <= totalCols; c++) {
        const colDef = columns[c - 1];
        const colLetter = getExcelColLetter(c);

        const cellSum = sumRow.getCell(c);
        cellSum.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' },
        };
        cellSum.border = borderThin;

        const cellSub = subtotalRow.getCell(c);
        cellSub.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFF6FF' },
        };
        cellSub.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'double', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        const cellHdr = headerRow.getCell(c);
        cellHdr.value = colDef.header;
        cellHdr.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF334155' },
        };
        cellHdr.border = borderThin;

        if (c === labelColIndex) {
          cellSum.value = 'TỔNG CỘNG (SUM)';
          cellSum.alignment = { horizontal: 'left', vertical: 'middle' };
          cellSub.value = 'TỔNG THEO BỘ LỌC (SUBTOTAL)';
          cellSub.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        if (colDef.isSum) {
          const sumVal = calculatedSums[colDef.key] || 0;
          cellSum.value = {
            formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
            result: sumVal,
          };
          cellSum.alignment = { horizontal: 'right', vertical: 'middle' };
          cellSum.numFmt = colDef.style?.numFmt || '#,##0.00';

          cellSub.value = {
            formula: `SUBTOTAL(9,${colLetter}${startRow}:${colLetter}${endRow})`,
            result: sumVal,
          };
          cellSub.alignment = { horizontal: 'right', vertical: 'middle' };
          cellSub.numFmt = colDef.style?.numFmt || '#,##0.00';
        }
      }

      sheet.views = [{ state: 'frozen', ySplit: 4 }];
      sheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: endRow, column: totalCols },
      };
    };

    // Sheet 1: Tổng quan
    const stats = await this.statsService.getDashboardStats(
      dateFrom,
      dateTo,
      branchId,
    );
    const sheet1 = workbook.addWorksheet('Tổng quan');
    const sheet1Columns = [
      { header: 'Tháng', key: 'month', width: 20 },
      {
        header: 'Doanh thu (VND)',
        key: 'cashIn',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Chi phí (VND)',
        key: 'cashOut',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
    ];
    initSheet(sheet1, sheet1Columns);

    let sheet1SumCashIn = 0;
    let sheet1SumCashOut = 0;

    stats.cashTrend.forEach((t) => {
      sheet1SumCashIn += Number(t.cashIn) || 0;
      sheet1SumCashOut += Number(t.cashOut) || 0;
      const row = sheet1.addRow({
        month: t.label,
        cashIn: t.cashIn,
        cashOut: t.cashOut,
      });
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).numFmt = '#,##0.00';
      for (let c = 1; c <= 3; c++) row.getCell(c).border = borderThin;
    });

    finalizeSheet(
      sheet1,
      sheet1Columns,
      { cashIn: sheet1SumCashIn, cashOut: sheet1SumCashOut },
      1,
    );

    // Fetch all partners
    const partnersResult = await this.partnersService.getDashboardPartners(
      1,
      100000,
      undefined,
      dateFrom,
      dateTo,
      branchId,
    );

    // Sheet 2: Công nợ phải thu
    const sheet2 = workbook.addWorksheet('Phải thu');
    const sheet2Columns = [
      { header: 'Mã số thuế', key: 'taxCode', width: 18 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      {
        header: 'Tổng hóa đơn xuất',
        key: 'totalOut',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Dư nợ phải thu',
        key: 'receivable',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
    ];
    initSheet(sheet2, sheet2Columns);

    const receivables = partnersResult.items
      .filter((p) => p.receivableAmount > 0)
      .sort((a, b) => b.receivableAmount - a.receivableAmount);

    let sheet2SumTotalOut = 0;
    let sheet2SumReceivable = 0;

    receivables.forEach((p) => {
      sheet2SumTotalOut += Number(p.totalOutAmount) || 0;
      sheet2SumReceivable += Number(p.receivableAmount) || 0;
      const row = sheet2.addRow({
        taxCode: p.taxCode,
        partnerName: p.partnerName,
        totalOut: p.totalOutAmount,
        receivable: p.receivableAmount,
      });
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).numFmt = '#,##0.00';
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).numFmt = '#,##0.00';
      for (let c = 1; c <= 4; c++) row.getCell(c).border = borderThin;
    });

    finalizeSheet(
      sheet2,
      sheet2Columns,
      { totalOut: sheet2SumTotalOut, receivable: sheet2SumReceivable },
      2,
    );

    // Sheet 3: Công nợ phải trả
    const sheet3 = workbook.addWorksheet('Phải trả');
    const sheet3Columns = [
      { header: 'Mã số thuế', key: 'taxCode', width: 18 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      {
        header: 'Tổng hóa đơn nhập',
        key: 'totalIn',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Dư nợ phải trả',
        key: 'payable',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
    ];
    initSheet(sheet3, sheet3Columns);

    const payables = partnersResult.items
      .filter((p) => p.payableAmount > 0)
      .sort((a, b) => b.payableAmount - a.payableAmount);

    let sheet3SumTotalIn = 0;
    let sheet3SumPayable = 0;

    payables.forEach((p) => {
      sheet3SumTotalIn += Number(p.totalInAmount) || 0;
      sheet3SumPayable += Number(p.payableAmount) || 0;
      const row = sheet3.addRow({
        taxCode: p.taxCode,
        partnerName: p.partnerName,
        totalIn: p.totalInAmount,
        payable: p.payableAmount,
      });
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).numFmt = '#,##0.00';
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).numFmt = '#,##0.00';
      for (let c = 1; c <= 4; c++) row.getCell(c).border = borderThin;
    });

    finalizeSheet(
      sheet3,
      sheet3Columns,
      { totalIn: sheet3SumTotalIn, payable: sheet3SumPayable },
      2,
    );

    // Fetch detailed invoices
    const detailedInvoices = await this.getDetailedInvoices(
      dateFrom,
      dateTo,
      branchId,
    );

    // Sheet 4: Chi tiết phải thu (OUT)
    const sheet4 = workbook.addWorksheet('Chi tiết phải thu');
    const sheet4Columns = [
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 20 },
      { header: 'Mã số thuế', key: 'buyerTaxCode', width: 18 },
      { header: 'Khách hàng', key: 'buyerName', width: 40 },
      {
        header: 'Tiền trước thuế',
        key: 'preVatAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Thuế VAT',
        key: 'vatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Tổng tiền',
        key: 'totalAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Đã thu',
        key: 'paidAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];
    initSheet(sheet4, sheet4Columns);

    let sheet4SumPreVat = 0;
    let sheet4SumVat = 0;
    let sheet4SumTotal = 0;
    let sheet4SumPaid = 0;
    let sheet4SumRemaining = 0;

    const outInvoices = detailedInvoices.filter((i) => i.direction === 'OUT');
    outInvoices.forEach((i) => {
      sheet4SumPreVat += Number(i.preVatAmount) || 0;
      sheet4SumVat += Number(i.vatAmount) || 0;
      sheet4SumTotal += Number(i.totalAmount) || 0;
      sheet4SumPaid += Number(i.paidAmount) || 0;
      sheet4SumRemaining += Number(i.remainingAmount) || 0;

      const row = sheet4.addRow({
        invoiceDate: i.invoiceDate,
        serialNo: i.serialNo,
        invoiceNo: i.invoiceNo,
        buyerTaxCode: i.buyerTaxCode,
        buyerName: i.buyerName,
        preVatAmount: i.preVatAmount,
        vatAmount: i.vatAmount,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        remainingAmount: i.remainingAmount,
        status: i.status,
      });
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      for (let c = 1; c <= 11; c++) row.getCell(c).border = borderThin;
    });

    finalizeSheet(
      sheet4,
      sheet4Columns,
      {
        preVatAmount: sheet4SumPreVat,
        vatAmount: sheet4SumVat,
        totalAmount: sheet4SumTotal,
        paidAmount: sheet4SumPaid,
        remainingAmount: sheet4SumRemaining,
      },
      5,
    );

    // Sheet 5: Chi tiết phải trả (IN)
    const sheet5 = workbook.addWorksheet('Chi tiết phải trả');
    const sheet5Columns = [
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 20 },
      { header: 'Mã số thuế', key: 'sellerTaxCode', width: 18 },
      { header: 'Nhà cung cấp', key: 'sellerName', width: 40 },
      {
        header: 'Tiền trước thuế',
        key: 'preVatAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Thuế VAT',
        key: 'vatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Tổng tiền',
        key: 'totalAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Đã trả',
        key: 'paidAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 22,
        style: { numFmt: '#,##0.00' },
        isSum: true,
      },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];
    initSheet(sheet5, sheet5Columns);

    let sheet5SumPreVat = 0;
    let sheet5SumVat = 0;
    let sheet5SumTotal = 0;
    let sheet5SumPaid = 0;
    let sheet5SumRemaining = 0;

    const inInvoices = detailedInvoices.filter((i) => i.direction === 'IN');
    inInvoices.forEach((i) => {
      sheet5SumPreVat += Number(i.preVatAmount) || 0;
      sheet5SumVat += Number(i.vatAmount) || 0;
      sheet5SumTotal += Number(i.totalAmount) || 0;
      sheet5SumPaid += Number(i.paidAmount) || 0;
      sheet5SumRemaining += Number(i.remainingAmount) || 0;

      const row = sheet5.addRow({
        invoiceDate: i.invoiceDate,
        serialNo: i.serialNo,
        invoiceNo: i.invoiceNo,
        sellerTaxCode: i.sellerTaxCode,
        sellerName: i.sellerName,
        preVatAmount: i.preVatAmount,
        vatAmount: i.vatAmount,
        totalAmount: i.totalAmount,
        paidAmount: i.paidAmount,
        remainingAmount: i.remainingAmount,
        status: i.status,
      });
      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      for (let c = 1; c <= 11; c++) row.getCell(c).border = borderThin;
    });

    finalizeSheet(
      sheet5,
      sheet5Columns,
      {
        preVatAmount: sheet5SumPreVat,
        vatAmount: sheet5SumVat,
        totalAmount: sheet5SumTotal,
        paidAmount: sheet5SumPaid,
        remainingAmount: sheet5SumRemaining,
      },
      5,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
