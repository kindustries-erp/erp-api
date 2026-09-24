import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class InvoiceDashboardService {
  private readonly logger = new Logger(InvoiceDashboardService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  async getDashboardStats(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ) {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.invoice_date, 'YYYY-MM')", 'month')
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashOut',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashIn',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)",
        'vatIn',
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.vat_amount AS NUMERIC) ELSE 0 END)",
        'vatOut',
      )
      .where('inv.is_deleted = false')
      .andWhere(
        '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
      );

    if (dateFrom) {
      qb.andWhere('inv.invoice_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      qb.andWhere('inv.invoice_date <= :dateTo', { dateTo: effectiveDateTo });
    }
    if (branchId) {
      if (branchId === 'null') {
        qb.andWhere('inv.branch_id IS NULL');
      } else {
        qb.andWhere('inv.branch_id = :branchId', { branchId });
      }
    }

    qb.groupBy("TO_CHAR(inv.invoice_date, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    // Format to cashTrend structure
    const cashTrend = result.map((r) => ({
      label: r.month,
      cashIn: Number(r.cashIn) || 0,
      cashOut: Number(r.cashOut) || 0,
      vatIn: Number(r.vatIn) || 0,
      vatOut: Number(r.vatOut) || 0,
    }));

    return { cashTrend };
  }

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
  ) {
    // Build the query to get aggregated data grouped by taxCode and partnerName
    // Because a partner might be both buyer and seller (though rare), we group by the relevant side
    // For IN invoices, we are the buyer, so the partner is the seller
    // For OUT invoices, we are the seller, so the partner is the buyer
    const partnerQuery = `
      SELECT 
        CASE 
          WHEN inv.direction = 'IN' THEN inv.seller_tax_code
          WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code
        END as "taxCode",
        MAX(
          CASE 
            WHEN inv.direction = 'IN' THEN inv.seller_name
            WHEN inv.direction = 'OUT' THEN inv.buyer_name
          END
        ) as "partnerName",
        SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END) as "totalInAmount",
        SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END) as "totalOutAmount",
        SUM(CASE WHEN inv.direction = 'IN' THEN COALESCE(netoff.net_off_amount, 0) ELSE 0 END) as "paidAmount",
        SUM(CASE WHEN inv.direction = 'OUT' THEN COALESCE(netoff.net_off_amount, 0) ELSE 0 END) as "receivedAmount"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        ${dateFrom ? `AND inv.invoice_date >= '${dateFrom}'` : ''}
        ${dateTo ? `AND inv.invoice_date <= '${dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo}'` : ''}
        ${branchId ? (branchId === 'null' ? `AND inv.branch_id IS NULL` : `AND inv.branch_id = '${branchId}'`) : ''}
      GROUP BY 
        CASE 
          WHEN inv.direction = 'IN' THEN inv.seller_tax_code
          WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code
        END
      HAVING 
        CASE 
          WHEN inv.direction = 'IN' THEN inv.seller_tax_code
          WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code
        END IS NOT NULL 
        AND 
        CASE 
          WHEN inv.direction = 'IN' THEN inv.seller_tax_code
          WHEN inv.direction = 'OUT' THEN inv.buyer_tax_code
        END != ''
    `;

    // Wrapping for search and pagination
    let finalQuery = `SELECT * FROM (${partnerQuery}) p`;
    const whereConditions: string[] = [];

    if (search) {
      const s = search.replace(/'/g, "''");
      whereConditions.push(
        `(p."taxCode" ILIKE '%${s}%' OR p."partnerName" ILIKE '%${s}%')`,
      );
    }

    if (columnSearch) {
      try {
        const cSearch = JSON.parse(columnSearch) as Record<string, string>;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          const s = val.replace(/'/g, "''");
          if (col === 'taxCode') {
            whereConditions.push(`p."taxCode" ILIKE '%${s}%'`);
          } else if (col === 'partnerName') {
            whereConditions.push(`p."partnerName" ILIKE '%${s}%'`);
          }
        }
      } catch (e) {}
    }

    if (columnFilters) {
      try {
        const cFilters = JSON.parse(columnFilters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          const quotedVals = vals
            .map((v) => `'${v.replace(/'/g, "''")}'`)
            .join(', ');
          if (col === 'taxCode') {
            whereConditions.push(`p."taxCode" IN (${quotedVals})`);
          } else if (col === 'partnerName') {
            whereConditions.push(`p."partnerName" IN (${quotedVals})`);
          }
        }
      } catch (e) {}
    }

    if (sortBy === 'payableAmount') {
      whereConditions.push(`(p."totalInAmount" - p."paidAmount") > 0`);
    } else if (sortBy === 'receivableAmount') {
      whereConditions.push(`(p."totalOutAmount" - p."receivedAmount") > 0`);
    }

    if (whereConditions.length > 0) {
      finalQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(*) as count FROM (${finalQuery}) as t`;
    const countResult = await this.invoiceRepo.query(countQuery);
    const total = parseInt(countResult[0]?.count || '0', 10);

    let orderClause = `ORDER BY p."totalInAmount" + p."totalOutAmount" DESC`;
    if (sortBy === 'payableAmount') {
      orderClause = `ORDER BY p."totalInAmount" - p."paidAmount" ${sortOrder || 'DESC'}`;
    } else if (sortBy === 'receivableAmount') {
      orderClause = `ORDER BY p."totalOutAmount" - p."receivedAmount" ${sortOrder || 'DESC'}`;
    } else if (sortBy) {
      // Just in case other columns are sorted
      orderClause = `ORDER BY p."${sortBy}" ${sortOrder || 'DESC'}`;
    }

    const dataQuery = `${finalQuery} ${orderClause} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    const rawData = await this.invoiceRepo.query(dataQuery);

    const items = rawData.map((r: any) => {
      const totalIn = Number(r.totalInAmount) || 0;
      const totalOut = Number(r.totalOutAmount) || 0;
      const paid = Number(r.paidAmount) || 0;
      const received = Number(r.receivedAmount) || 0;

      return {
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        totalInAmount: totalIn,
        totalOutAmount: totalOut,
        payableAmount: totalIn > paid ? totalIn - paid : 0, // Invoices we received (IN) minus what we paid
        receivableAmount: totalOut > received ? totalOut - received : 0, // Invoices we issued (OUT) minus what we received
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getPartnerStats(taxCode: string, dateFrom?: string, dateTo?: string) {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.invoice_date, 'YYYY-MM')", 'month')
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'IN' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashOut', // Input invoices mean we pay money (cashOut)
      )
      .addSelect(
        "SUM(CASE WHEN inv.direction = 'OUT' THEN CAST(inv.total_amount AS NUMERIC) ELSE 0 END)",
        'cashIn', // Output invoices mean we receive money (cashIn)
      )
      .where('inv.is_deleted = false')
      .andWhere(
        '(inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)',
      )
      .andWhere(
        '(inv.seller_tax_code = :taxCode OR inv.buyer_tax_code = :taxCode)',
        { taxCode },
      );

    if (dateFrom) {
      qb.andWhere('inv.invoice_date >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      const effectiveDateTo =
        dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      qb.andWhere('inv.invoice_date <= :dateTo', { dateTo: effectiveDateTo });
    }

    qb.groupBy("TO_CHAR(inv.invoice_date, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    const cashTrend = result.map((r) => ({
      label: r.month,
      cashIn: Number(r.cashIn) || 0,
      cashOut: Number(r.cashOut) || 0,
    }));

    return { cashTrend };
  }

  async getDetailedInvoices(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ) {
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
    if (dateTo) {
      const effTo = dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo;
      whereConditions.push(`inv.invoice_date <= '${effTo}'`);
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

    const getColLetter = (colIndex: number): string => {
      let letter = '';
      let temp = colIndex;
      while (temp > 0) {
        const mod = (temp - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        temp = Math.floor((temp - mod) / 26);
      }
      return letter;
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
        const colLetter = getColLetter(c);

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
    const stats = await this.getDashboardStats(dateFrom, dateTo, branchId);
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
    const partnersResult = await this.getDashboardPartners(
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

  async getDebtsAnalytics(
    dateFrom?: string,
    dateTo?: string,
    branchId?: string,
  ) {
    let dateFilter = '';
    const params: any[] = [];
    let pIdx = 1;

    if (dateFrom) {
      dateFilter += ` AND inv.invoice_date >= $${pIdx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      dateFilter += ` AND inv.invoice_date <= $${pIdx++}`;
      params.push(effTo);
    }
    if (branchId) {
      if (branchId === 'null') {
        dateFilter += ` AND inv.branch_id IS NULL`;
      } else {
        dateFilter += ` AND inv.branch_id = $${pIdx++}`;
        params.push(branchId);
      }
    }

    // 1. Overall Aggregation by Direction and Aging
    const summaryQuery = `
      SELECT 
        inv.direction,
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(COALESCE(netoff.net_off_amount, 0)) as "paidAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "remainingAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging0To30",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 60
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging31To60",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 60 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 90
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "aging61To90",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 90
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "agingOver90",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 7
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "dueNextWeek"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
      ${dateFilter}
      GROUP BY inv.direction
    `;

    const summaryRows = await this.invoiceRepo.query(summaryQuery, params);

    let outTotal = 0,
      outPaid = 0,
      outBal = 0,
      outA0_30 = 0,
      outA31_60 = 0,
      outA61_90 = 0,
      outAOver90 = 0,
      outNextWeek = 0;
    let inTotal = 0,
      inPaid = 0,
      inBal = 0,
      inA0_30 = 0,
      inA31_60 = 0,
      inA61_90 = 0,
      inAOver90 = 0,
      inNextWeek = 0;

    for (const r of summaryRows) {
      if (r.direction === 'OUT') {
        outTotal = Number(r.totalAmount) || 0;
        outPaid = Number(r.paidAmount) || 0;
        outBal = Number(r.remainingAmount) || 0;
        outA0_30 = Number(r.aging0To30) || 0;
        outA31_60 = Number(r.aging31To60) || 0;
        outA61_90 = Number(r.aging61To90) || 0;
        outAOver90 = Number(r.agingOver90) || 0;
        outNextWeek = Number(r.dueNextWeek) || 0;
      } else if (r.direction === 'IN') {
        inTotal = Number(r.totalAmount) || 0;
        inPaid = Number(r.paidAmount) || 0;
        inBal = Number(r.remainingAmount) || 0;
        inA0_30 = Number(r.aging0To30) || 0;
        inA31_60 = Number(r.aging31To60) || 0;
        inA61_90 = Number(r.aging61To90) || 0;
        inAOver90 = Number(r.agingOver90) || 0;
        inNextWeek = Number(r.dueNextWeek) || 0;
      }
    }

    const netBalance = outBal - inBal;
    const collectionRate = outTotal > 0 ? (outPaid / outTotal) * 100 : 0;
    const paymentRate = inTotal > 0 ? (inPaid / inTotal) * 100 : 0;

    // 2. Monthly Trend
    const trendStats = await this.getDashboardStats(dateFrom, dateTo, branchId);
    const cashTrend = trendStats.cashTrend.map((t) => ({
      label: t.label,
      cashIn: t.cashIn,
      cashOut: t.cashOut,
      netCash: t.cashIn - t.cashOut,
      vatIn: t.vatIn,
      vatOut: t.vatOut,
    }));

    // 3. Top 5 Receivable Customers
    const topCustomersQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST') as "taxCode",
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') as "partnerName",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "overdueAmount",
        MAX(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
            THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
            ELSE 0 
          END
        ) as "maxAgingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = 'OUT'
        ${dateFilter}
      GROUP BY 
        COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST'),
        COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')
      HAVING SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) > 0
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;

    const rawTopCustomers = await this.invoiceRepo.query(
      topCustomersQuery,
      params,
    );
    const topReceivableCustomers = rawTopCustomers.map((r: any) => ({
      taxCode: r.taxCode,
      partnerName: r.partnerName,
      totalAmount: Number(r.totalAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      overdueAmount: Number(r.overdueAmount) || 0,
      maxAgingDays: Number(r.maxAgingDays) || 0,
    }));

    // 4. Top 5 Payable Suppliers
    const topSuppliersQuery = `
      SELECT 
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST') as "taxCode",
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') as "partnerName",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "overdueAmount",
        MAX(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
            THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
            ELSE 0 
          END
        ) as "maxAgingDays"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND inv.direction = 'IN'
        ${dateFilter}
      GROUP BY 
        COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST'),
        COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')
      HAVING SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) > 0
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;

    const rawTopSuppliers = await this.invoiceRepo.query(
      topSuppliersQuery,
      params,
    );
    const topPayableSuppliers = rawTopSuppliers.map((r: any) => ({
      taxCode: r.taxCode,
      partnerName: r.partnerName,
      totalAmount: Number(r.totalAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      overdueAmount: Number(r.overdueAmount) || 0,
      maxAgingDays: Number(r.maxAgingDays) || 0,
    }));

    // 5. Compute Forecast Horizons (Cashflow Forecasting Algorithms)
    // 5.1 Partner Lag Forecast (DSO/DPO Lag Engine)
    const forecastLagQuery = `
      SELECT 
        inv.direction,
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '7 days')::date
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "forecastNext7Days",
        SUM(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '30 days')::date
            THEN GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))
            ELSE 0 
          END
        ) as "forecastNext30Days"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      LEFT JOIN (
        SELECT 
          COALESCE(NULLIF(TRIM(i2.buyer_tax_code), ''), NULLIF(TRIM(i2.buyer_cccd), ''), NULLIF(TRIM(i2.seller_tax_code), ''), 'KHONG_MST') as tax_code,
          i2.direction,
          ROUND(AVG(GREATEST(1, bt2.trans_date::date - i2.invoice_date::date))) as avg_lag_days
        FROM erp_invoice_voucher_netoff no2
        JOIN erp_invoices i2 ON i2.id = no2.invoice_id
        JOIN erp_bank_transactions bt2 ON bt2.id = no2.bank_transaction_id
        WHERE i2.is_deleted = false
        GROUP BY 1, 2
      ) pl ON pl.tax_code = (
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')
        END
      ) AND pl.direction = inv.direction
      WHERE inv.is_deleted = false AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
      ${dateFilter}
      GROUP BY inv.direction
    `;

    const forecastLagRows = await this.invoiceRepo.query(
      forecastLagQuery,
      params,
    );
    let outF7 = 0,
      outF30 = 0,
      inF7 = 0,
      inF30 = 0;
    for (const r of forecastLagRows) {
      if (r.direction === 'OUT') {
        outF7 = Number(r.forecastNext7Days) || 0;
        outF30 = Number(r.forecastNext30Days) || 0;
      } else if (r.direction === 'IN') {
        inF7 = Number(r.forecastNext7Days) || 0;
        inF30 = Number(r.forecastNext30Days) || 0;
      }
    }

    // 5.2 IFRS 9 Expected Cashflow & Default Risk Provision
    const expRec = Math.round(
      outA0_30 * 0.85 + outA31_60 * 0.6 + outA61_90 * 0.3 + outAOver90 * 0.1,
    );
    const expPay = Math.round(
      inA0_30 * 0.95 + inA31_60 * 0.85 + inA61_90 * 0.7 + inAOver90 * 0.5,
    );
    const riskRec = Math.round(
      outA0_30 * 0.15 + outA31_60 * 0.4 + outA61_90 * 0.7 + outAOver90 * 0.9,
    );
    const riskPay = Math.round(
      inA0_30 * 0.05 + inA31_60 * 0.15 + inA61_90 * 0.3 + inAOver90 * 0.5,
    );

    const forecastHorizons = {
      next7Days: {
        receivable: outF7,
        payable: inF7,
        net: outF7 - inF7,
      },
      next30Days: {
        receivable: outF30,
        payable: inF30,
        net: outF30 - inF30,
      },
      expectedCashflow: {
        receivable: expRec,
        payable: expPay,
        net: expRec - expPay,
      },
      defaultRiskProvision: {
        receivableRisk: riskRec,
        payableRisk: riskPay,
        netRisk: riskRec - riskPay,
      },
    };

    return {
      summary: {
        totalReceivable: outTotal,
        paidReceivable: outPaid,
        remainingReceivable: outBal,
        totalPayable: inTotal,
        paidPayable: inPaid,
        remainingPayable: inBal,
        netBalance,
        collectionRate,
        paymentRate,
      },
      agingComparison: [
        {
          bracket: '0_30' as const,
          label: '0-30 ngày',
          receivableAmount: outA0_30,
          payableAmount: inA0_30,
          netAmount: outA0_30 - inA0_30,
        },
        {
          bracket: '31_60' as const,
          label: '31-60 ngày',
          receivableAmount: outA31_60,
          payableAmount: inA31_60,
          netAmount: outA31_60 - inA31_60,
        },
        {
          bracket: '61_90' as const,
          label: '61-90 ngày',
          receivableAmount: outA61_90,
          payableAmount: inA61_90,
          netAmount: outA61_90 - inA61_90,
        },
        {
          bracket: 'over_90' as const,
          label: '>90 ngày',
          receivableAmount: outAOver90,
          payableAmount: inAOver90,
          netAmount: outAOver90 - inAOver90,
        },
      ],
      timeHorizons: {
        nextWeekDue: {
          receivable: outNextWeek,
          payable: inNextWeek,
          net: outNextWeek - inNextWeek,
        },
        nextMonthDue: {
          receivable: outA0_30,
          payable: inA0_30,
          net: outA0_30 - inA0_30,
        },
        overdue30To90: {
          receivable: outA31_60 + outA61_90,
          payable: inA31_60 + inA61_90,
          net: outA31_60 + outA61_90 - (inA31_60 + inA61_90),
        },
        criticalOverdue90Plus: {
          receivable: outAOver90,
          payable: inAOver90,
          net: outAOver90 - inAOver90,
        },
      },
      forecastHorizons,
      cashTrend,
      topReceivableCustomers,
      topPayableSuppliers,
    };
  }

  /**
   * Lấy danh sách chi tiết hóa đơn theo từng Mốc thời gian (Time Horizon & Forecast Horizon)
   */
  async getTimeHorizonInvoices(
    horizon: string,
    query: {
      dateFrom?: string;
      dateTo?: string;
      branchId?: string;
      direction?: 'ALL' | 'IN' | 'OUT';
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'ASC' | 'DESC';
      columnSearch?: string;
      columnFilters?: string;
    },
  ) {
    const {
      dateFrom,
      dateTo,
      branchId,
      direction = 'ALL',
      search,
      page = 1,
      pageSize = 20,
      sortBy,
      sortOrder = 'DESC',
      columnSearch,
      columnFilters,
    } = query;

    // Horizon condition
    let horizonSql = '';
    let horizonLabel = '';
    switch (horizon) {
      case 'nextWeekDue':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) <= 7`;
        horizonLabel = 'Mới phát sinh (≤ 7 ngày)';
        break;
      case 'nextMonthDue':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) <= 30`;
        horizonLabel = 'Trong hạn chuẩn (≤ 30 ngày)';
        break;
      case 'overdue30To90':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) > 30 AND (CURRENT_DATE - inv.invoice_date::date) <= 90`;
        horizonLabel = 'Quá hạn 31-90 ngày';
        break;
      case 'criticalOverdue90Plus':
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) > 90`;
        horizonLabel = 'Quá hạn >90 ngày';
        break;
      case 'forecastNext7Days':
      case 'forecastNextWeek':
        horizonSql = `(inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '7 days')::date`;
        horizonLabel = 'Dự báo 7 ngày tới (T+7)';
        break;
      case 'forecastNext30Days':
      case 'forecastNextMonth':
        horizonSql = `(inv.invoice_date::date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval)::date <= (CURRENT_DATE + INTERVAL '30 days')::date`;
        horizonLabel = 'Kế hoạch 30 ngày tới (T+30)';
        break;
      case 'expectedCashflow':
        horizonSql = `1=1`;
        horizonLabel = 'Dòng tiền kỳ vọng (IFRS 9)';
        break;
      case 'defaultRiskProvision':
        horizonSql = `1=1`;
        horizonLabel = 'Dự phòng rủi ro nợ (IFRS 9)';
        break;
      default:
        horizonSql = `1=1`;
        horizonLabel = 'Mốc thời gian';
    }

    // Base query for invoices within this horizon with remaining balance > 0
    let baseQuery = `
      SELECT 
        inv.id,
        inv.invoice_no as "invoiceNo",
        inv.serial_no as "serialNo",
        TO_CHAR(inv.invoice_date, 'YYYY-MM-DD') as "invoiceDate",
        inv.direction,
        inv.seller_name as "sellerName",
        inv.seller_tax_code as "sellerTaxCode",
        inv.seller_address as "sellerAddress",
        inv.buyer_name as "buyerName",
        inv.buyer_tax_code as "buyerTaxCode",
        inv.buyer_personal_name as "buyerPersonalName",
        inv.buyer_cccd as "buyerCccd",
        inv.buyer_address as "buyerAddress",
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')
        END as "partnerName",
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')
        END as "taxCode",
        CAST(inv.pre_vat_amount AS NUMERIC) as "preVatAmount",
        CAST(inv.vat_amount AS NUMERIC) as "vatAmount",
        CAST(inv.total_amount AS NUMERIC) as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) as "balanceAmount",
        GREATEST(0, (CURRENT_DATE - inv.invoice_date::date)) as "agingDays",
        COALESCE(pl.avg_lag_days, 30) as "partnerAvgLagDays",
        TO_CHAR(inv.invoice_date + (COALESCE(pl.avg_lag_days, 30) || ' days')::interval, 'YYYY-MM-DD') as "estimatedSettlementDate",
        CASE 
          WHEN inv.direction = 'OUT' THEN
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 85
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 60
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
              ELSE 10
            END
          ELSE
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 95
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 85
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
              ELSE 50
            END
        END as "recoveryProbability",
        CASE 
          WHEN inv.direction = 'OUT' THEN
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 15
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 40
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
              ELSE 90
            END
          ELSE
            CASE 
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 5
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 15
              WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
              ELSE 50
            END
        END as "riskProbability",
        ROUND(
          GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) * (
            CASE 
              WHEN inv.direction = 'OUT' THEN
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 85
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 60
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
                  ELSE 10
                END
              ELSE
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 95
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 85
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
                  ELSE 50
                END
            END
          ) / 100.0
        ) as "expectedAmount",
        ROUND(
          GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) * (
            CASE 
              WHEN inv.direction = 'OUT' THEN
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 15
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 40
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 70
                  ELSE 90
                END
              ELSE
                CASE 
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 5
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 15
                  WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
                  ELSE 50
                END
            END
          ) / 100.0
        ) as "riskAmount",
        inv.status,
        inv.tax_invoice_status as "taxInvoiceStatus",
        inv.description,
        inv.branch_id as "branchId"
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      LEFT JOIN (
        SELECT 
          COALESCE(NULLIF(TRIM(i2.buyer_tax_code), ''), NULLIF(TRIM(i2.buyer_cccd), ''), NULLIF(TRIM(i2.seller_tax_code), ''), 'KHONG_MST') as tax_code,
          i2.direction,
          ROUND(AVG(GREATEST(1, bt2.trans_date::date - i2.invoice_date::date))) as avg_lag_days
        FROM erp_invoice_voucher_netoff no2
        JOIN erp_invoices i2 ON i2.id = no2.invoice_id
        JOIN erp_bank_transactions bt2 ON bt2.id = no2.bank_transaction_id
        WHERE i2.is_deleted = false
        GROUP BY 1, 2
      ) pl ON pl.tax_code = (
        CASE 
          WHEN inv.direction = 'OUT' THEN COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')
          ELSE COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')
        END
      ) AND pl.direction = inv.direction
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
        AND (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0
        AND ${horizonSql}
    `;

    if (dateFrom) {
      baseQuery += ` AND inv.invoice_date >= '${dateFrom.replace(/'/g, "''")}'`;
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? dateTo + ' 23:59:59.999' : dateTo;
      baseQuery += ` AND inv.invoice_date <= '${effTo.replace(/'/g, "''")}'`;
    }
    if (branchId) {
      if (branchId === 'null') {
        baseQuery += ` AND inv.branch_id IS NULL`;
      } else {
        baseQuery += ` AND inv.branch_id = '${branchId.replace(/'/g, "''")}'`;
      }
    }

    // 1. Calculate Summary across ALL directions for this horizon
    let metricField = `"balanceAmount"`;
    if (horizon === 'expectedCashflow') {
      metricField = `"expectedAmount"`;
    } else if (horizon === 'defaultRiskProvision') {
      metricField = `"riskAmount"`;
    }

    const summarySql = `
      SELECT 
        SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "receivableAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "payableAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."totalAmount" ELSE 0 END) as "receivableTotalAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."totalAmount" ELSE 0 END) as "payableTotalAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."paidAmount" ELSE 0 END) as "receivedAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."paidAmount" ELSE 0 END) as "paidAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."expectedAmount" ELSE 0 END) as "receivableExpectedAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."expectedAmount" ELSE 0 END) as "payableExpectedAmount",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."riskAmount" ELSE 0 END) as "receivableRiskAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."riskAmount" ELSE 0 END) as "payableRiskAmount",
        COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "receivableCount",
        COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "payableCount",
        -- Maturity Breakdown for Forecast Horizons (Due in Period vs Overdue Carried Over)
        SUM(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "outDueInPeriodAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN 1 ELSE NULL END) as "outDueInPeriodCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "outOverdueCarriedAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "outOverdueCarriedCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "inDueInPeriodAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date >= CURRENT_DATE THEN 1 ELSE NULL END) as "inDueInPeriodCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "inOverdueCarriedAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "inOverdueCarriedCount"
      FROM (${baseQuery}) q
    `;
    const summaryRows = await this.invoiceRepo.query(summarySql);
    const sRow = summaryRows[0] || {};
    const receivableAmount = Number(sRow.receivableAmount) || 0;
    const payableAmount = Number(sRow.payableAmount) || 0;
    const receivableTotalAmount = Number(sRow.receivableTotalAmount) || 0;
    const payableTotalAmount = Number(sRow.payableTotalAmount) || 0;
    const receivedAmount = Number(sRow.receivedAmount) || 0;
    const paidAmount = Number(sRow.paidAmount) || 0;
    const receivableExpectedAmount = Number(sRow.receivableExpectedAmount) || 0;
    const payableExpectedAmount = Number(sRow.payableExpectedAmount) || 0;
    const receivableRiskAmount = Number(sRow.receivableRiskAmount) || 0;
    const payableRiskAmount = Number(sRow.payableRiskAmount) || 0;
    const receivableCount = parseInt(sRow.receivableCount || '0', 10);
    const payableCount = parseInt(sRow.payableCount || '0', 10);
    const netAmount = receivableAmount - payableAmount;

    // Maturity breakdown details
    const maturityBreakdown = {
      outDueInPeriodAmount: Number(sRow.outDueInPeriodAmount) || 0,
      outDueInPeriodCount: parseInt(sRow.outDueInPeriodCount || '0', 10),
      outOverdueCarriedAmount: Number(sRow.outOverdueCarriedAmount) || 0,
      outOverdueCarriedCount: parseInt(sRow.outOverdueCarriedCount || '0', 10),
      inDueInPeriodAmount: Number(sRow.inDueInPeriodAmount) || 0,
      inDueInPeriodCount: parseInt(sRow.inDueInPeriodCount || '0', 10),
      inOverdueCarriedAmount: Number(sRow.inOverdueCarriedAmount) || 0,
      inOverdueCarriedCount: parseInt(sRow.inOverdueCarriedCount || '0', 10),
    };

    // Top 5 Receivable Customers in this horizon sorted by the specific horizon metric
    const topReceivableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        SUM(q.${metricField}) as "contributingAmount",
        COUNT(q.id) as "invoiceCount",
        ROUND(AVG(q."partnerAvgLagDays")) as "avgLagDays",
        SUM(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "overdueCarriedAmount",
        COUNT(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "overdueInvoicesCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'OUT'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "contributingAmount" DESC, "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopRec = await this.invoiceRepo.query(topReceivableSql);
    const topReceivablePartners = rawTopRec.map((r: any) => {
      const contributingAmount = Number(r.contributingAmount) || 0;
      const sharePercentage =
        receivableAmount > 0
          ? Number(((contributingAmount / receivableAmount) * 100).toFixed(1))
          : 0;
      const overdueCarriedAmount = Number(r.overdueCarriedAmount) || 0;
      return {
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        balanceAmount: Number(r.balanceAmount) || 0,
        contributingAmount,
        sharePercentage,
        invoiceCount: parseInt(r.invoiceCount || '0', 10),
        avgLagDays: Math.round(Number(r.avgLagDays) || 30),
        overdueCarriedAmount,
        overdueInvoicesCount: parseInt(r.overdueInvoicesCount || '0', 10),
        isOverdueLag: overdueCarriedAmount > 0,
      };
    });

    // Top 5 Payable Suppliers in this horizon sorted by the specific horizon metric
    const topPayableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        SUM(q.${metricField}) as "contributingAmount",
        COUNT(q.id) as "invoiceCount",
        ROUND(AVG(q."partnerAvgLagDays")) as "avgLagDays",
        SUM(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN q.${metricField} ELSE 0 END) as "overdueCarriedAmount",
        COUNT(CASE WHEN q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate"::date < CURRENT_DATE THEN 1 ELSE NULL END) as "overdueInvoicesCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'IN'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "contributingAmount" DESC, "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopPay = await this.invoiceRepo.query(topPayableSql);
    const topPayablePartners = rawTopPay.map((r: any) => {
      const contributingAmount = Number(r.contributingAmount) || 0;
      const sharePercentage =
        payableAmount > 0
          ? Number(((contributingAmount / payableAmount) * 100).toFixed(1))
          : 0;
      const overdueCarriedAmount = Number(r.overdueCarriedAmount) || 0;
      return {
        taxCode: r.taxCode,
        partnerName: r.partnerName,
        balanceAmount: Number(r.balanceAmount) || 0,
        contributingAmount,
        sharePercentage,
        invoiceCount: parseInt(r.invoiceCount || '0', 10),
        avgLagDays: Math.round(Number(r.avgLagDays) || 30),
        overdueCarriedAmount,
        overdueInvoicesCount: parseInt(r.overdueInvoicesCount || '0', 10),
        isOverdueLag: overdueCarriedAmount > 0,
      };
    });

    // Monthly Trend aggregated across invoices in this horizon
    const monthlyTrendSql = `
      SELECT 
        SUBSTRING(q."invoiceDate", 1, 7) as "month",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."totalAmount" ELSE 0 END) as "outTotal",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."paidAmount" ELSE 0 END) as "outPaid",
        SUM(CASE WHEN q.direction = 'OUT' THEN q."balanceAmount" ELSE 0 END) as "outBalance",
        SUM(CASE WHEN q.direction = 'IN' THEN q."totalAmount" ELSE 0 END) as "inTotal",
        SUM(CASE WHEN q.direction = 'IN' THEN q."paidAmount" ELSE 0 END) as "inPaid",
        SUM(CASE WHEN q.direction = 'IN' THEN q."balanceAmount" ELSE 0 END) as "inBalance",
        COUNT(q.id) as "invoiceCount"
      FROM (${baseQuery}) q
      WHERE q."invoiceDate" IS NOT NULL AND q."invoiceDate" != ''
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    const rawMonthly = await this.invoiceRepo.query(monthlyTrendSql);
    const monthlyTrend = rawMonthly.map((r: any) => ({
      month: r.month,
      outTotal: Number(r.outTotal) || 0,
      outPaid: Number(r.outPaid) || 0,
      outBalance: Number(r.outBalance) || 0,
      inTotal: Number(r.inTotal) || 0,
      inPaid: Number(r.inPaid) || 0,
      inBalance: Number(r.inBalance) || 0,
      invoiceCount: parseInt(r.invoiceCount || '0', 10),
    }));

    // Daily Forecast Timeline - Chỉ tính cho Forecast Horizons (T+7 / T+30)
    // Group hóa đơn theo estimatedSettlementDate:
    //   - estimatedSettlementDate < TODAY => gộp vào bucket 'OVERDUE' (Quá hạn trôi sang)
    //   - estimatedSettlementDate >= TODAY => từng ngày cụ thể (YYYY-MM-DD)
    let dailyForecastTimeline: {
      dateKey: string; // 'OVERDUE' hoặc 'YYYY-MM-DD'
      outAmount: number;
      outCount: number;
      inAmount: number;
      inCount: number;
    }[] = [];

    const isForecastHorizonApi =
      horizon === 'forecastNext7Days' ||
      horizon === 'forecastNextWeek' ||
      horizon === 'forecastNext30Days' ||
      horizon === 'forecastNextMonth';

    if (isForecastHorizonApi) {
      const dailyForecastSql = `
        SELECT
          CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END as "dateKey",
          SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "outAmount",
          COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "outCount",
          SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "inAmount",
          COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "inCount"
        FROM (${baseQuery}) q
        WHERE q."estimatedSettlementDate" IS NOT NULL AND q."estimatedSettlementDate" != ''
        GROUP BY 1
        ORDER BY
          CASE WHEN CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END = 'OVERDUE' THEN '0000-00-00' ELSE CASE
            WHEN q."estimatedSettlementDate"::date < CURRENT_DATE THEN 'OVERDUE'
            ELSE TO_CHAR(q."estimatedSettlementDate"::date, 'YYYY-MM-DD')
          END END ASC
      `;
      const rawDaily = await this.invoiceRepo.query(dailyForecastSql);
      dailyForecastTimeline = rawDaily.map((r: any) => ({
        dateKey: r.dateKey,
        outAmount: Number(r.outAmount) || 0,
        outCount: parseInt(r.outCount || '0', 10),
        inAmount: Number(r.inAmount) || 0,
        inCount: parseInt(r.inCount || '0', 10),
      }));
    }

    // Aging Breakdown (4 standard buckets) for both OUT and IN
    const agingBreakdownSql = `
      SELECT 
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" <= 30 THEN q."balanceAmount" ELSE 0 END) as "outAging0_30",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 30 AND q."agingDays" <= 60 THEN q."balanceAmount" ELSE 0 END) as "outAging31_60",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 60 AND q."agingDays" <= 90 THEN q."balanceAmount" ELSE 0 END) as "outAging61_90",
        SUM(CASE WHEN q.direction = 'OUT' AND q."agingDays" > 90 THEN q."balanceAmount" ELSE 0 END) as "outAgingOver90",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" <= 30 THEN q."balanceAmount" ELSE 0 END) as "inAging0_30",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 30 AND q."agingDays" <= 60 THEN q."balanceAmount" ELSE 0 END) as "inAging31_60",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 60 AND q."agingDays" <= 90 THEN q."balanceAmount" ELSE 0 END) as "inAging61_90",
        SUM(CASE WHEN q.direction = 'IN' AND q."agingDays" > 90 THEN q."balanceAmount" ELSE 0 END) as "inAgingOver90"
      FROM (${baseQuery}) q
    `;
    const rawAging = await this.invoiceRepo.query(agingBreakdownSql);
    const aRow = rawAging[0] || {};
    const agingBreakdown = {
      outAging0_30: Number(aRow.outAging0_30) || 0,
      outAging31_60: Number(aRow.outAging31_60) || 0,
      outAging61_90: Number(aRow.outAging61_90) || 0,
      outAgingOver90: Number(aRow.outAgingOver90) || 0,
      inAging0_30: Number(aRow.inAging0_30) || 0,
      inAging31_60: Number(aRow.inAging31_60) || 0,
      inAging61_90: Number(aRow.inAging61_90) || 0,
      inAgingOver90: Number(aRow.inAgingOver90) || 0,
    };

    // Ticket Size Pareto Distribution (Quy mô hóa đơn: <10M, 10-50M, 50-100M, >100M)
    const ticketSizeSql = `
      SELECT
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" < 10000000 THEN q.${metricField} ELSE 0 END) as "outUnder10mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" < 10000000 THEN 1 ELSE NULL END) as "outUnder10mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN q.${metricField} ELSE 0 END) as "out10mTo50mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN 1 ELSE NULL END) as "out10mTo50mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN q.${metricField} ELSE 0 END) as "out50mTo100mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN 1 ELSE NULL END) as "out50mTo100mCount",
        SUM(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 100000000 THEN q.${metricField} ELSE 0 END) as "outOver100mAmount",
        COUNT(CASE WHEN q.direction = 'OUT' AND q."totalAmount" >= 100000000 THEN 1 ELSE NULL END) as "outOver100mCount",

        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" < 10000000 THEN q.${metricField} ELSE 0 END) as "inUnder10mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" < 10000000 THEN 1 ELSE NULL END) as "inUnder10mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN q.${metricField} ELSE 0 END) as "in10mTo50mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 10000000 AND q."totalAmount" < 50000000 THEN 1 ELSE NULL END) as "in10mTo50mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN q.${metricField} ELSE 0 END) as "in50mTo100mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 50000000 AND q."totalAmount" < 100000000 THEN 1 ELSE NULL END) as "in50mTo100mCount",
        SUM(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 100000000 THEN q.${metricField} ELSE 0 END) as "inOver100mAmount",
        COUNT(CASE WHEN q.direction = 'IN' AND q."totalAmount" >= 100000000 THEN 1 ELSE NULL END) as "inOver100mCount"
      FROM (${baseQuery}) q
    `;
    const rawTicket = await this.invoiceRepo.query(ticketSizeSql);
    const tRow = rawTicket[0] || {};
    const ticketSizeBuckets = {
      outUnder10mAmount: Number(tRow.outUnder10mAmount) || 0,
      outUnder10mCount: parseInt(tRow.outUnder10mCount || '0', 10),
      out10mTo50mAmount: Number(tRow.out10mTo50mAmount) || 0,
      out10mTo50mCount: parseInt(tRow.out10mTo50mCount || '0', 10),
      out50mTo100mAmount: Number(tRow.out50mTo100mAmount) || 0,
      out50mTo100mCount: parseInt(tRow.out50mTo100mCount || '0', 10),
      outOver100mAmount: Number(tRow.outOver100mAmount) || 0,
      outOver100mCount: parseInt(tRow.outOver100mCount || '0', 10),

      inUnder10mAmount: Number(tRow.inUnder10mAmount) || 0,
      inUnder10mCount: parseInt(tRow.inUnder10mCount || '0', 10),
      in10mTo50mAmount: Number(tRow.in10mTo50mAmount) || 0,
      in10mTo50mCount: parseInt(tRow.in10mTo50mCount || '0', 10),
      in50mTo100mAmount: Number(tRow.in50mTo100mAmount) || 0,
      in50mTo100mCount: parseInt(tRow.in50mTo100mCount || '0', 10),
      inOver100mAmount: Number(tRow.inOver100mAmount) || 0,
      inOver100mCount: parseInt(tRow.inOver100mCount || '0', 10),
    };

    // Phân rã theo chi nhánh / địa điểm (Branch breakdown)
    const branchBreakdownSql = `
      SELECT 
        COALESCE(q."branchId"::text, 'UNASSIGNED') as "branchId",
        COALESCE(b.name, CASE WHEN q."branchId" IS NULL THEN 'Chưa phân chi nhánh' ELSE 'Chi nhánh khác' END) as "branchName",
        COALESCE(b.code, '') as "branchCode",
        SUM(CASE WHEN q.direction = 'OUT' THEN q.${metricField} ELSE 0 END) as "outAmount",
        COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "outCount",
        SUM(CASE WHEN q.direction = 'IN' THEN q.${metricField} ELSE 0 END) as "inAmount",
        COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "inCount"
      FROM (${baseQuery}) q
      LEFT JOIN erp_branches b ON b.id = q."branchId"
      GROUP BY q."branchId", b.name, b.code
      ORDER BY "outAmount" DESC, "inAmount" DESC
    `;
    const rawBranch = await this.invoiceRepo.query(branchBreakdownSql);
    const branchBreakdown = rawBranch.map((r: any) => ({
      branchId: r.branchId,
      branchName:
        r.branchName ||
        (r.branchId === 'UNASSIGNED' ? 'Chưa phân chi nhánh' : r.branchId),
      branchCode: r.branchCode || '',
      outAmount: Number(r.outAmount) || 0,
      outCount: parseInt(r.outCount || '0', 10),
      inAmount: Number(r.inAmount) || 0,
      inCount: parseInt(r.inCount || '0', 10),
    }));

    // 2. Filter wrapper for items list
    let filteredQuery = `SELECT * FROM (${baseQuery}) p`;
    const whereConditions: string[] = [];

    if (direction && direction !== 'ALL') {
      whereConditions.push(`p.direction = '${direction}'`);
    }

    if (search && search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      whereConditions.push(
        `(p."invoiceNo" ILIKE '%${s}%' OR p."serialNo" ILIKE '%${s}%' OR p."partnerName" ILIKE '%${s}%' OR p."taxCode" ILIKE '%${s}%' OR p.description ILIKE '%${s}%')`,
      );
    }

    if (columnSearch) {
      try {
        const cSearch = JSON.parse(columnSearch) as Record<string, string>;
        for (const [col, rawVal] of Object.entries(cSearch)) {
          if (!rawVal || !rawVal.trim()) continue;
          if (col === 'invoiceNo') {
            const noClause = this.buildKeywordSqlClause(
              `p."invoiceNo"`,
              rawVal.trim(),
            );
            const serialClause = this.buildKeywordSqlClause(
              `p."serialNo"`,
              rawVal.trim(),
            );
            if (noClause && serialClause) {
              whereConditions.push(`(${noClause} OR ${serialClause})`);
            } else if (noClause) {
              whereConditions.push(noClause);
            }
          } else if (col === 'partner' || col === 'partnerName') {
            const nameClause = this.buildKeywordSqlClause(
              `p."partnerName"`,
              rawVal.trim(),
            );
            const taxClause = this.buildKeywordSqlClause(
              `p."taxCode"`,
              rawVal.trim(),
            );
            if (nameClause && taxClause) {
              whereConditions.push(`(${nameClause} OR ${taxClause})`);
            } else if (nameClause) {
              whereConditions.push(nameClause);
            }
          } else {
            const searchClause = this.buildKeywordSqlClause(
              `p."${col}"`,
              rawVal.trim(),
            );
            if (searchClause) whereConditions.push(searchClause);
          }
        }
      } catch (e) {}
    }

    if (columnFilters) {
      try {
        const cFilters = JSON.parse(columnFilters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;

          if (vals[0] === '__ALL_MATCHING__') {
            const searchKeyword = vals[1] || '';
            if (searchKeyword) {
              const searchClause = this.buildKeywordSqlClause(
                `p."${col}"`,
                searchKeyword,
              );
              if (searchClause) whereConditions.push(searchClause);
            }
            continue;
          }

          const hasBlank = vals.includes('__BLANK__');
          const validVals = vals.filter((v) => v !== '__BLANK__');

          const condParts: string[] = [];
          if (validVals.length > 0) {
            const quotedVals = validVals
              .map((v) => `'${v.replace(/'/g, "''")}'`)
              .join(', ');
            condParts.push(`CAST(p."${col}" AS TEXT) IN (${quotedVals})`);
          }
          if (hasBlank) {
            condParts.push(
              `(p."${col}" IS NULL OR CAST(p."${col}" AS TEXT) = '' OR CAST(p."${col}" AS TEXT) = 'KHONG_MST')`,
            );
          }
          if (condParts.length > 0) {
            whereConditions.push(`(${condParts.join(' OR ')})`);
          }
        }
      } catch (e) {}
    }

    if (whereConditions.length > 0) {
      filteredQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Count Total
    const countSql = `SELECT COUNT(*) as count FROM (${filteredQuery}) as t`;
    const countRes = await this.invoiceRepo.query(countSql);
    const total = parseInt(countRes[0]?.count || '0', 10);

    // Sorting & Pagination
    let orderClause = `ORDER BY p."balanceAmount" DESC, p."invoiceDate" DESC`;
    if (sortBy) {
      const cleanSortBy = sortBy.replace(/"/g, '');
      const cleanOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY p."${cleanSortBy}" ${cleanOrder}, p."balanceAmount" DESC`;
    }

    const safePageSize = Math.max(1, Math.min(200, pageSize));
    const offset = (Math.max(1, page) - 1) * safePageSize;
    const dataSql = `${filteredQuery} ${orderClause} LIMIT ${safePageSize} OFFSET ${offset}`;
    const rawData = await this.invoiceRepo.query(dataSql);

    const items = rawData.map((r: any) => ({
      id: r.id,
      invoiceNo: r.invoiceNo,
      serialNo: r.serialNo,
      invoiceDate: r.invoiceDate,
      direction: r.direction,
      sellerName: r.sellerName,
      sellerTaxCode: r.sellerTaxCode,
      sellerAddress: r.sellerAddress,
      buyerName: r.buyerName || r.buyerPersonalName,
      buyerTaxCode: r.buyerTaxCode || r.buyerCccd,
      buyerAddress: r.buyerAddress,
      partnerName: r.partnerName,
      taxCode: r.taxCode,
      preVatAmount: Number(r.preVatAmount) || 0,
      vatAmount: Number(r.vatAmount) || 0,
      totalAmount: Number(r.totalAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      agingDays: parseInt(r.agingDays || '0', 10),
      partnerAvgLagDays: Math.round(Number(r.partnerAvgLagDays) || 30),
      estimatedSettlementDate: r.estimatedSettlementDate || null,
      recoveryProbability: Number(r.recoveryProbability) || 0,
      riskProbability: Number(r.riskProbability) || 0,
      expectedAmount: Number(r.expectedAmount) || 0,
      riskAmount: Number(r.riskAmount) || 0,
      status: r.status,
      taxInvoiceStatus: r.taxInvoiceStatus,
      description: r.description,
    }));

    return {
      summary: {
        horizon,
        horizonLabel,
        receivableAmount,
        payableAmount,
        receivableTotalAmount,
        payableTotalAmount,
        receivedAmount,
        paidAmount,
        receivableExpectedAmount,
        payableExpectedAmount,
        receivableRiskAmount,
        payableRiskAmount,
        netAmount,
        receivableCount,
        payableCount,
        topReceivablePartners,
        topPayablePartners,
        monthlyTrend,
        agingBreakdown,
        maturityBreakdown,
        dailyForecastTimeline,
        ticketSizeBuckets,
        branchBreakdown,
      },
      items,
      total,
      page,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  /**
   * Helper: Xây dựng mệnh đề SQL cho Exact search ("...") và Multi-search (;)
   */
  private buildKeywordSqlClause(
    sqlField: string,
    searchString: string,
  ): string | null {
    if (!searchString || !searchString.trim()) return null;

    const keywords = searchString
      .split(';')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return null;

    const clauses = keywords.map((kw) => {
      let isExact = false;
      let cleanKw = kw;
      if (kw.startsWith('"') && kw.endsWith('"') && kw.length >= 2) {
        isExact = true;
        cleanKw = kw.slice(1, -1);
      }
      const escaped = cleanKw.replace(/'/g, "''");
      return isExact
        ? `CAST(${sqlField} AS TEXT) ILIKE '${escaped}'`
        : `CAST(${sqlField} AS TEXT) ILIKE '%${escaped}%'`;
    });

    return `(${clauses.join(' OR ')})`;
  }
}
