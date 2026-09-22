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
        horizonSql = `(CURRENT_DATE - inv.invoice_date::date) > 30`;
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
          WHEN (CURRENT_DATE - inv.invoice_date::date) <= 30 THEN 85
          WHEN (CURRENT_DATE - inv.invoice_date::date) <= 60 THEN 60
          WHEN (CURRENT_DATE - inv.invoice_date::date) <= 90 THEN 30
          ELSE 10
        END as "recoveryProbability",
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
    const summarySql = `
      SELECT 
        SUM(CASE WHEN q.direction = 'OUT' THEN q."balanceAmount" ELSE 0 END) as "receivableAmount",
        SUM(CASE WHEN q.direction = 'IN' THEN q."balanceAmount" ELSE 0 END) as "payableAmount",
        COUNT(CASE WHEN q.direction = 'OUT' THEN 1 ELSE NULL END) as "receivableCount",
        COUNT(CASE WHEN q.direction = 'IN' THEN 1 ELSE NULL END) as "payableCount"
      FROM (${baseQuery}) q
    `;
    const summaryRows = await this.invoiceRepo.query(summarySql);
    const sRow = summaryRows[0] || {};
    const receivableAmount = Number(sRow.receivableAmount) || 0;
    const payableAmount = Number(sRow.payableAmount) || 0;
    const receivableCount = parseInt(sRow.receivableCount || '0', 10);
    const payableCount = parseInt(sRow.payableCount || '0', 10);
    const netAmount = receivableAmount - payableAmount;

    // Top 5 Receivable Customers in this horizon
    const topReceivableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        COUNT(q.id) as "invoiceCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'OUT'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopRec = await this.invoiceRepo.query(topReceivableSql);
    const topReceivablePartners = rawTopRec.map((r: any) => ({
      taxCode: r.taxCode,
      partnerName: r.partnerName,
      balanceAmount: Number(r.balanceAmount) || 0,
      invoiceCount: parseInt(r.invoiceCount || '0', 10),
    }));

    // Top 5 Payable Suppliers in this horizon
    const topPayableSql = `
      SELECT 
        q."taxCode",
        q."partnerName",
        SUM(q."balanceAmount") as "balanceAmount",
        COUNT(q.id) as "invoiceCount"
      FROM (${baseQuery}) q
      WHERE q.direction = 'IN'
      GROUP BY q."taxCode", q."partnerName"
      ORDER BY "balanceAmount" DESC
      LIMIT 5
    `;
    const rawTopPay = await this.invoiceRepo.query(topPayableSql);
    const topPayablePartners = rawTopPay.map((r: any) => ({
      taxCode: r.taxCode,
      partnerName: r.partnerName,
      balanceAmount: Number(r.balanceAmount) || 0,
      invoiceCount: parseInt(r.invoiceCount || '0', 10),
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
          const searchClause = this.buildKeywordSqlClause(
            `p."${col}"`,
            rawVal.trim(),
          );
          if (searchClause) whereConditions.push(searchClause);
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
            condParts.push(`p."${col}" IN (${quotedVals})`);
          }
          if (hasBlank) {
            condParts.push(
              `(p."${col}" IS NULL OR p."${col}" = '' OR p."${col}" = 'KHONG_MST')`,
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
        netAmount,
        receivableCount,
        payableCount,
        topReceivablePartners,
        topPayablePartners,
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
        ? `${sqlField} ILIKE '${escaped}'`
        : `${sqlField} ILIKE '%${escaped}%'`;
    });

    return `(${clauses.join(' OR ')})`;
  }
}
