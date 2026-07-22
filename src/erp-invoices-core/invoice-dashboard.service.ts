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
      .andWhere("inv.status != 'CANCELLED'");

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
      WHERE inv.is_deleted = false AND inv.status != 'CANCELLED'
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
      .andWhere("inv.status != 'CANCELLED'")
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
      WHERE inv.is_deleted = false AND inv.status != 'CANCELLED'
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

    // Sheet 1: Tổng quan
    const stats = await this.getDashboardStats(dateFrom, dateTo, branchId);
    const sheet1 = workbook.addWorksheet('Tổng quan');
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];
    sheet1.autoFilter = 'A1:C1';
    sheet1.columns = [
      { header: 'Tháng', key: 'month', width: 20 },
      {
        header: 'Doanh thu (VND)',
        key: 'cashIn',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Chi phí (VND)',
        key: 'cashOut',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
    ];
    stats.cashTrend.forEach((t) => {
      sheet1.addRow({
        month: t.label,
        cashIn: t.cashIn,
        cashOut: t.cashOut,
      });
    });

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
    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = 'A1:D1';
    sheet2.columns = [
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      {
        header: 'Tổng hóa đơn xuất',
        key: 'totalOut',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Dư nợ phải thu',
        key: 'receivable',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
    ];

    const receivables = partnersResult.items
      .filter((p) => p.receivableAmount > 0)
      .sort((a, b) => b.receivableAmount - a.receivableAmount);

    receivables.forEach((p) => {
      sheet2.addRow({
        taxCode: p.taxCode,
        partnerName: p.partnerName,
        totalOut: p.totalOutAmount,
        receivable: p.receivableAmount,
      });
    });

    // Sheet 3: Công nợ phải trả
    const sheet3 = workbook.addWorksheet('Phải trả');
    sheet3.views = [{ state: 'frozen', ySplit: 1 }];
    sheet3.autoFilter = 'A1:D1';
    sheet3.columns = [
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      {
        header: 'Tổng hóa đơn nhập',
        key: 'totalIn',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Dư nợ phải trả',
        key: 'payable',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
    ];

    const payables = partnersResult.items
      .filter((p) => p.payableAmount > 0)
      .sort((a, b) => b.payableAmount - a.payableAmount);

    payables.forEach((p) => {
      sheet3.addRow({
        taxCode: p.taxCode,
        partnerName: p.partnerName,
        totalIn: p.totalInAmount,
        payable: p.payableAmount,
      });
    });

    // Fetch detailed invoices
    const detailedInvoices = await this.getDetailedInvoices(
      dateFrom,
      dateTo,
      branchId,
    );

    // Sheet 4: Chi tiết phải thu (OUT)
    const sheet4 = workbook.addWorksheet('Chi tiết phải thu');
    sheet4.views = [{ state: 'frozen', ySplit: 1 }];
    sheet4.autoFilter = 'A1:K1';
    sheet4.columns = [
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 20 },
      { header: 'Mã số thuế', key: 'buyerTaxCode', width: 15 },
      { header: 'Khách hàng', key: 'buyerName', width: 40 },
      {
        header: 'Tiền trước thuế',
        key: 'preVatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thuế VAT',
        key: 'vatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tổng tiền',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã thu',
        key: 'paidAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

    const outInvoices = detailedInvoices.filter((i) => i.direction === 'OUT');
    outInvoices.forEach((i) => {
      sheet4.addRow({
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
    });

    // Sheet 5: Chi tiết phải trả (IN)
    const sheet5 = workbook.addWorksheet('Chi tiết phải trả');
    sheet5.views = [{ state: 'frozen', ySplit: 1 }];
    sheet5.autoFilter = 'A1:K1';
    sheet5.columns = [
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 20 },
      { header: 'Mã số thuế', key: 'sellerTaxCode', width: 15 },
      { header: 'Nhà cung cấp', key: 'sellerName', width: 40 },
      {
        header: 'Tiền trước thuế',
        key: 'preVatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Thuế VAT',
        key: 'vatAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Tổng tiền',
        key: 'totalAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Đã trả',
        key: 'paidAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      {
        header: 'Còn lại',
        key: 'remainingAmount',
        width: 20,
        style: { numFmt: '#,##0.00' },
      },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

    const inInvoices = detailedInvoices.filter((i) => i.direction === 'IN');
    inInvoices.forEach((i) => {
      sheet5.addRow({
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
    });

    workbook.worksheets.forEach((s) => {
      s.getRow(1).font = { bold: true };
      s.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
      s.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }
}
