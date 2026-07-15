import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from './entities/erp_invoice.entity';

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
      qb.andWhere('inv.branch_id = :branchId', { branchId });
    }

    qb.groupBy("TO_CHAR(inv.invoice_date, 'YYYY-MM')");
    qb.orderBy('month', 'ASC');

    const result = await qb.getRawMany();

    // Format to cashTrend structure
    const cashTrend = result.map((r) => ({
      label: r.month,
      cashIn: Number(r.cashIn) || 0,
      cashOut: Number(r.cashOut) || 0,
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
  ) {
    // Build the query to get aggregated data grouped by taxCode and partnerName
    // Because a partner might be both buyer and seller (though rare), we group by the relevant side
    // For IN invoices, we are the buyer, so the partner is the seller
    // For OUT invoices, we are the seller, so the partner is the buyer
    const partnerQuery = `
      SELECT 
        COALESCE(inv.seller_tax_code, inv.buyer_tax_code) as "taxCode",
        MAX(COALESCE(inv.seller_name, inv.buyer_name)) as "partnerName",
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
        ${branchId ? `AND inv.branch_id = '${branchId}'` : ''}
      GROUP BY COALESCE(inv.seller_tax_code, inv.buyer_tax_code)
      HAVING COALESCE(inv.seller_tax_code, inv.buyer_tax_code) IS NOT NULL AND COALESCE(inv.seller_tax_code, inv.buyer_tax_code) != ''
    `;

    // Wrapping for search and pagination
    let finalQuery = `SELECT * FROM (${partnerQuery}) p`;
    if (search) {
      const s = search.replace(/'/g, "''");
      finalQuery += ` WHERE p."taxCode" ILIKE '%${s}%' OR p."partnerName" ILIKE '%${s}%'`;
    }

    const countQuery = `SELECT COUNT(*) as count FROM (${finalQuery}) as t`;
    const countResult = await this.invoiceRepo.query(countQuery);
    const total = parseInt(countResult[0]?.count || '0', 10);

    const dataQuery = `${finalQuery} ORDER BY p."totalInAmount" + p."totalOutAmount" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
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
}
