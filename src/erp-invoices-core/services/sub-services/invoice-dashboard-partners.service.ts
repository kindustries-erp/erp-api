import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { normalizeEffectiveDateTo } from './invoice-dashboard-helpers';

export interface DashboardPartnerItem {
  taxCode: string;
  partnerName: string;
  totalInAmount: number;
  totalOutAmount: number;
  payableAmount: number;
  receivableAmount: number;
}

export interface DashboardPartnersResponse {
  items: DashboardPartnerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class InvoiceDashboardPartnersService {
  private readonly logger = new Logger(InvoiceDashboardPartnersService.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Truy vấn danh sách phân trang tổng hợp doanh thu/chi phí và công nợ phải thu/phải trả theo đối tác
   */
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
  ): Promise<DashboardPartnersResponse> {
    const effectiveDateTo = normalizeEffectiveDateTo(dateTo);

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
        ${effectiveDateTo ? `AND inv.invoice_date <= '${effectiveDateTo}'` : ''}
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
      } catch (e) {
        this.logger.warn(`Failed to parse columnSearch: ${e}`);
      }
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
      } catch (e) {
        this.logger.warn(`Failed to parse columnFilters: ${e}`);
      }
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

    const items: DashboardPartnerItem[] = rawData.map((r: any) => {
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
}
