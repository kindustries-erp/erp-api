import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { ErpInvoice } from '../entities/erp_invoice.entity';
import {
  GetInvoiceDebtsQueryDto,
  GetInvoiceDebtColumnOptionsQueryDto,
  InvoicePartnerType,
} from '../dto/get-invoice-debts.dto';

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

@Injectable()
export class InvoiceDebtsService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Truy vấn danh sách tổng hợp công nợ Khách hàng hoặc Nhà cung cấp
   */
  async getDebts(
    queryDto: GetInvoiceDebtsQueryDto,
  ): Promise<InvoiceDebtsResponse> {
    const {
      partner_type = InvoicePartnerType.CUSTOMER,
      page = 1,
      pageSize = 20,
      search,
      date_from,
      date_to,
      branch_id,
      sortBy,
      sortOrder = 'DESC',
      column_search,
      column_filters,
    } = queryDto;

    const direction =
      partner_type === InvoicePartnerType.SUPPLIER ? 'IN' : 'OUT';

    // 1. Base Aggregation Subquery
    const partnerTaxExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')`;

    const rawPartnerNameExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')`;

    const partnerAddressExpr =
      direction === 'IN' ? `MAX(inv.seller_address)` : `MAX(inv.buyer_address)`;

    let baseQuery = `
      SELECT 
        ${partnerTaxExpr} as "taxCode",
        ${rawPartnerNameExpr} as "partnerName",
        ${partnerAddressExpr} as "address",
        COUNT(DISTINCT inv.id) as "invoiceCount",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(COALESCE(netoff.net_off_amount, 0)) as "paidAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount",
        MAX(
          CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
            THEN GREATEST(0, (CURRENT_DATE - inv.invoice_date::date))
            ELSE 0 
          END
        ) as "maxAgingDays",
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
        COUNT(
          DISTINCT CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 30
            THEN inv.id 
            ELSE NULL 
          END
        ) as "count0To30",
        COUNT(
          DISTINCT CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 30 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 60
            THEN inv.id 
            ELSE NULL 
          END
        ) as "count31To60",
        COUNT(
          DISTINCT CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 60 
                 AND (CURRENT_DATE - inv.invoice_date::date) <= 90
            THEN inv.id 
            ELSE NULL 
          END
        ) as "count61To90",
        COUNT(
          DISTINCT CASE 
            WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0 
                 AND (CURRENT_DATE - inv.invoice_date::date) > 90
            THEN inv.id 
            ELSE NULL 
          END
        ) as "countOver90",
        COALESCE(
          ROUND(
            SUM(
              CASE 
                WHEN (CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) > 0
                THEN (GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) * GREATEST(0, (CURRENT_DATE - inv.invoice_date::date)))
                ELSE 0 
              END
            ) / NULLIF(SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))), 0)
          ),
          0
        ) as "weightedAgingDays",
        TO_CHAR(MAX(inv.invoice_date), 'YYYY-MM-DD') as "latestInvoiceDate",
        MAX(inv.branch_id::text) as "branchId"
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

    if (date_from) {
      baseQuery += ` AND inv.invoice_date >= '${date_from.replace(/'/g, "''")}'`;
    }
    if (date_to) {
      const effDateTo =
        date_to.length === 10 ? `${date_to} 23:59:59.999` : date_to;
      baseQuery += ` AND inv.invoice_date <= '${effDateTo.replace(/'/g, "''")}'`;
    }
    if (branch_id) {
      if (branch_id === 'null') {
        baseQuery += ` AND inv.branch_id IS NULL`;
      } else {
        baseQuery += ` AND inv.branch_id = '${branch_id.replace(/'/g, "''")}'`;
      }
    }

    baseQuery += ` GROUP BY ${rawPartnerNameExpr}, ${partnerTaxExpr}`;

    // 2. Filter wrapper
    let finalQuery = `SELECT * FROM (${baseQuery}) p`;
    const whereConditions: string[] = [];

    // Global search
    if (search && search.trim().length > 0) {
      const s = search.trim().replace(/'/g, "''");
      whereConditions.push(
        `(p."taxCode" ILIKE '%${s}%' OR p."partnerName" ILIKE '%${s}%' OR p."address" ILIKE '%${s}%')`,
      );
    }

    // Column search (Exact search "" & Multi-search ;)
    if (column_search) {
      try {
        const cSearch = JSON.parse(column_search) as Record<string, string>;
        for (const [col, rawVal] of Object.entries(cSearch)) {
          if (!rawVal || !rawVal.trim()) continue;
          const val = rawVal.trim();

          const searchClause = this.buildKeywordSqlClause(`p."${col}"`, val);
          if (searchClause) {
            whereConditions.push(searchClause);
          }
        }
      } catch (e) {}
    }

    // Column filters
    if (column_filters) {
      try {
        const cFilters = JSON.parse(column_filters) as Record<string, string[]>;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;

          // Xử lý __ALL_MATCHING__
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

          // Filter theo paymentProgress
          if (col === 'paymentProgress') {
            const progressConds: string[] = [];
            for (const v of vals) {
              if (v === 'PAID') {
                progressConds.push(
                  `(p."balanceAmount" <= 0 AND p."paidAmount" > 0)`,
                );
              } else if (v === 'PARTIAL') {
                progressConds.push(
                  `(p."paidAmount" > 0 AND p."balanceAmount" > 0)`,
                );
              } else if (v === 'UNPAID') {
                progressConds.push(
                  `(p."paidAmount" <= 0 AND p."balanceAmount" > 0)`,
                );
              }
            }
            if (progressConds.length > 0) {
              whereConditions.push(`(${progressConds.join(' OR ')})`);
            }
            continue;
          }

          // Filter theo maxAgingDays
          if (col === 'maxAgingDays') {
            const agingConds: string[] = [];
            for (const v of vals) {
              if (v === '0-30') {
                agingConds.push(`(p."aging0To30" > 0)`);
              } else if (v === '31-60') {
                agingConds.push(`(p."aging31To60" > 0)`);
              } else if (v === '61-90') {
                agingConds.push(`(p."aging61To90" > 0)`);
              } else if (v === '>90') {
                agingConds.push(`(p."agingOver90" > 0)`);
              } else if (v === 'PAID') {
                agingConds.push(`(p."balanceAmount" <= 0)`);
              }
            }
            if (agingConds.length > 0) {
              whereConditions.push(`(${agingConds.join(' OR ')})`);
            }
            continue;
          }

          // Lọc thông thường
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
      finalQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // 3. Count & Summary Query
    const countAndSummarySql = `
      SELECT 
        COUNT(*) as "totalPartners",
        COALESCE(SUM(p."invoiceCount"), 0) as "totalInvoiceCount",
        COALESCE(SUM(p."totalAmount"), 0) as "grandTotalAmount",
        COALESCE(SUM(p."paidAmount"), 0) as "grandTotalPaid",
        COALESCE(SUM(p."balanceAmount"), 0) as "grandTotalBalance",
        COALESCE(SUM(p."aging0To30"), 0) as "grandTotalAging0To30",
        COALESCE(SUM(p."aging31To60"), 0) as "grandTotalAging31To60",
        COALESCE(SUM(p."aging61To90"), 0) as "grandTotalAging61To90",
        COALESCE(SUM(p."agingOver90"), 0) as "grandTotalAgingOver90"
      FROM (${finalQuery}) as p
    `;
    const countResult = await this.invoiceRepo.query(countAndSummarySql);
    const summaryRow = countResult[0] || {};
    const total = parseInt(summaryRow.totalPartners || '0', 10);

    const summary: InvoiceDebtSummary = {
      totalPartners: total,
      totalInvoiceCount: parseInt(summaryRow.totalInvoiceCount || '0', 10),
      grandTotalAmount: Number(summaryRow.grandTotalAmount) || 0,
      grandTotalPaid: Number(summaryRow.grandTotalPaid) || 0,
      grandTotalBalance: Number(summaryRow.grandTotalBalance) || 0,
      grandTotalAging0To30: Number(summaryRow.grandTotalAging0To30) || 0,
      grandTotalAging31To60: Number(summaryRow.grandTotalAging31To60) || 0,
      grandTotalAging61To90: Number(summaryRow.grandTotalAging61To90) || 0,
      grandTotalAgingOver90: Number(summaryRow.grandTotalAgingOver90) || 0,
    };

    // 4. Order Clause
    let orderClause = `ORDER BY p."balanceAmount" DESC, p."totalAmount" DESC`;
    if (sortBy) {
      const cleanSortBy = sortBy.replace(/"/g, '');
      const cleanOrder = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderClause = `ORDER BY p."${cleanSortBy}" ${cleanOrder}, p."totalAmount" DESC`;
    }

    // 5. Paginated Data Query
    const safePageSize = Math.max(1, Math.min(200, pageSize));
    const offset = (Math.max(1, page) - 1) * safePageSize;
    const dataQuery = `${finalQuery} ${orderClause} LIMIT ${safePageSize} OFFSET ${offset}`;
    const rawData = await this.invoiceRepo.query(dataQuery);

    const items: InvoiceDebtItem[] = rawData.map((r: any) => ({
      taxCode: r.taxCode,
      partnerName: r.partnerName,
      address: r.address || undefined,
      invoiceCount: parseInt(r.invoiceCount || '0', 10),
      totalAmount: Number(r.totalAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balanceAmount: Number(r.balanceAmount) || 0,
      maxAgingDays: parseInt(r.maxAgingDays || '0', 10),
      weightedAgingDays: Number(r.weightedAgingDays) || 0,
      latestInvoiceDate: r.latestInvoiceDate || null,
      aging0To30: Number(r.aging0To30) || 0,
      aging31To60: Number(r.aging31To60) || 0,
      aging61To90: Number(r.aging61To90) || 0,
      agingOver90: Number(r.agingOver90) || 0,
      count0To30: parseInt(r.count0To30 || '0', 10),
      count31To60: parseInt(r.count31To60 || '0', 10),
      count61To90: parseInt(r.count61To90 || '0', 10),
      countOver90: parseInt(r.countOver90 || '0', 10),
    }));

    const totalPages = Math.ceil(total / safePageSize);

    // Calculate Cumulative Totals for Multi-page Navigation
    let cumulativeTotalAmount = 0;
    let cumulativePaidAmount = 0;
    let cumulativeBalanceAmount = 0;
    let cumulativeInvoiceCount = 0;
    let cumulativePartnersCount = 0;
    let cumulativeAging0To30 = 0;
    let cumulativeAging31To60 = 0;
    let cumulativeAging61To90 = 0;
    let cumulativeAgingOver90 = 0;

    if (page === 1) {
      for (const item of items) {
        cumulativeTotalAmount += item.totalAmount;
        cumulativePaidAmount += item.paidAmount;
        cumulativeBalanceAmount += item.balanceAmount;
        cumulativeInvoiceCount += item.invoiceCount;
        cumulativeAging0To30 += item.aging0To30;
        cumulativeAging31To60 += item.aging31To60;
        cumulativeAging61To90 += item.aging61To90;
        cumulativeAgingOver90 += item.agingOver90;
      }
      cumulativePartnersCount = items.length;
    } else if (page >= totalPages) {
      cumulativeTotalAmount = summary.grandTotalAmount;
      cumulativePaidAmount = summary.grandTotalPaid;
      cumulativeBalanceAmount = summary.grandTotalBalance;
      cumulativeInvoiceCount = summary.totalInvoiceCount;
      cumulativePartnersCount = total;
      cumulativeAging0To30 = summary.grandTotalAging0To30 || 0;
      cumulativeAging31To60 = summary.grandTotalAging31To60 || 0;
      cumulativeAging61To90 = summary.grandTotalAging61To90 || 0;
      cumulativeAgingOver90 = summary.grandTotalAgingOver90 || 0;
    } else {
      const cumSql = `
        SELECT 
          COUNT(*) as "cumulativePartnersCount",
          COALESCE(SUM(p."invoiceCount"), 0) as "cumulativeInvoiceCount",
          COALESCE(SUM(p."totalAmount"), 0) as "cumulativeTotalAmount",
          COALESCE(SUM(p."paidAmount"), 0) as "cumulativePaidAmount",
          COALESCE(SUM(p."balanceAmount"), 0) as "cumulativeBalanceAmount",
          COALESCE(SUM(p."aging0To30"), 0) as "cumulativeAging0To30",
          COALESCE(SUM(p."aging31To60"), 0) as "cumulativeAging31To60",
          COALESCE(SUM(p."aging61To90"), 0) as "cumulativeAging61To90",
          COALESCE(SUM(p."agingOver90"), 0) as "cumulativeAgingOver90"
        FROM (
          SELECT * FROM (${finalQuery}) p
          ${orderClause}
          LIMIT ${safePageSize * page}
        ) as p
      `;
      const cumResult = await this.invoiceRepo.query(cumSql);
      const cumRow = cumResult[0] || {};
      cumulativeTotalAmount = Number(cumRow.cumulativeTotalAmount) || 0;
      cumulativePaidAmount = Number(cumRow.cumulativePaidAmount) || 0;
      cumulativeBalanceAmount = Number(cumRow.cumulativeBalanceAmount) || 0;
      cumulativeInvoiceCount = parseInt(
        cumRow.cumulativeInvoiceCount || '0',
        10,
      );
      cumulativePartnersCount = parseInt(
        cumRow.cumulativePartnersCount || '0',
        10,
      );
      cumulativeAging0To30 = Number(cumRow.cumulativeAging0To30) || 0;
      cumulativeAging31To60 = Number(cumRow.cumulativeAging31To60) || 0;
      cumulativeAging61To90 = Number(cumRow.cumulativeAging61To90) || 0;
      cumulativeAgingOver90 = Number(cumRow.cumulativeAgingOver90) || 0;
    }

    summary.cumulativeTotalAmount = cumulativeTotalAmount;
    summary.cumulativePaidAmount = cumulativePaidAmount;
    summary.cumulativeBalanceAmount = cumulativeBalanceAmount;
    summary.cumulativeInvoiceCount = cumulativeInvoiceCount;
    summary.cumulativePartnersCount = cumulativePartnersCount;
    summary.cumulativeAging0To30 = cumulativeAging0To30;
    summary.cumulativeAging31To60 = cumulativeAging31To60;
    summary.cumulativeAging61To90 = cumulativeAging61To90;
    summary.cumulativeAgingOver90 = cumulativeAgingOver90;

    return {
      items,
      total,
      page,
      pageSize: safePageSize,
      totalPages,
      summary,
    };
  }

  /**
   * Lấy danh sách options phục vụ Server-side dropdown filter cho từng cột
   */
  async getColumnOptions(
    queryDto: GetInvoiceDebtColumnOptionsQueryDto,
  ): Promise<ColumnOptionsResponse> {
    const {
      partner_type = InvoicePartnerType.CUSTOMER,
      column_key,
      search,
      page = 1,
      pageSize = 20,
      filters,
      date_from,
      date_to,
      branch_id,
    } = queryDto;

    // Static options cho paymentProgress và maxAgingDays
    if (column_key === 'paymentProgress') {
      const staticItems: ColumnOptionItem[] = [
        { label: 'Đã tất toán', value: 'PAID' },
        { label: 'Thanh toán một phần', value: 'PARTIAL' },
        { label: 'Chưa thanh toán', value: 'UNPAID' },
      ];
      const filtered = search
        ? staticItems.filter((i) =>
            i.label.toLowerCase().includes(search.toLowerCase()),
          )
        : staticItems;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: filtered.length,
        totalPages: 1,
        next: null,
      };
    }

    if (column_key === 'maxAgingDays') {
      const staticItems: ColumnOptionItem[] = [
        { label: '0-30 ngày (Trong hạn)', value: '0-30' },
        { label: '31-60 ngày (Cần theo dõi)', value: '31-60' },
        { label: '61-90 ngày (Quá hạn)', value: '61-90' },
        { label: '>90 ngày (Quá hạn nghiêm trọng)', value: '>90' },
        { label: 'Đã tất toán', value: 'PAID' },
      ];
      const filtered = search
        ? staticItems.filter((i) =>
            i.label.toLowerCase().includes(search.toLowerCase()),
          )
        : staticItems;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: filtered.length,
        totalPages: 1,
        next: null,
      };
    }

    const direction =
      partner_type === InvoicePartnerType.SUPPLIER ? 'IN' : 'OUT';

    const partnerTaxExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_tax_code), ''), 'KHONG_MST')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_tax_code), ''), NULLIF(TRIM(inv.buyer_cccd), ''), 'KHONG_MST')`;

    const rawPartnerNameExpr =
      direction === 'IN'
        ? `COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp')`
        : `COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ')`;

    let baseQuery = `
      SELECT 
        ${partnerTaxExpr} as "taxCode",
        ${rawPartnerNameExpr} as "partnerName",
        COUNT(DISTINCT inv.id) as "invoiceCount",
        SUM(CAST(inv.total_amount AS NUMERIC)) as "totalAmount",
        SUM(COALESCE(netoff.net_off_amount, 0)) as "paidAmount",
        SUM(GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0))) as "balanceAmount"
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

    if (date_from) {
      baseQuery += ` AND inv.invoice_date >= '${date_from.replace(/'/g, "''")}'`;
    }
    if (date_to) {
      const effDateTo =
        date_to.length === 10 ? `${date_to} 23:59:59.999` : date_to;
      baseQuery += ` AND inv.invoice_date <= '${effDateTo.replace(/'/g, "''")}'`;
    }
    if (branch_id) {
      if (branch_id === 'null') {
        baseQuery += ` AND inv.branch_id IS NULL`;
      } else {
        baseQuery += ` AND inv.branch_id = '${branch_id.replace(/'/g, "''")}'`;
      }
    }

    baseQuery += ` GROUP BY ${rawPartnerNameExpr}, ${partnerTaxExpr}`;

    let colExpr = `p."${column_key}"`;
    if (
      column_key === 'invoiceCount' ||
      column_key === 'totalAmount' ||
      column_key === 'paidAmount' ||
      column_key === 'balanceAmount'
    ) {
      colExpr = `CAST(p."${column_key}" AS TEXT)`;
    }

    let query = `
      SELECT DISTINCT ${colExpr} as val
      FROM (${baseQuery}) p
      WHERE ${colExpr} IS NOT NULL AND ${colExpr} != ''
    `;

    if (search && search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      query += ` AND ${colExpr} ILIKE '%${s}%'`;
    }

    const countSql = `SELECT COUNT(*) as count FROM (${query}) as t`;
    const countRes = await this.invoiceRepo.query(countSql);
    const total = parseInt(countRes[0]?.count || '0', 10);

    const safePageSize = Math.max(1, Math.min(100, pageSize));
    const offset = (Math.max(1, page) - 1) * safePageSize;
    const dataSql = `${query} ORDER BY val ASC LIMIT ${safePageSize} OFFSET ${offset}`;
    const rawData = await this.invoiceRepo.query(dataSql);

    const items: ColumnOptionItem[] = rawData.map((r: any) => ({
      label: String(r.val),
      value: String(r.val),
    }));

    const totalPages = Math.ceil(total / safePageSize);

    return {
      items,
      total,
      page,
      pageSize: safePageSize,
      totalPages,
      next: page < totalPages ? page + 1 : null,
    };
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
    const direction =
      partnerType === InvoicePartnerType.SUPPLIER ? 'IN' : 'OUT';

    let query = `
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
        CAST(inv.pre_vat_amount AS NUMERIC) as "preVatAmount",
        CAST(inv.vat_amount AS NUMERIC) as "vatAmount",
        CAST(inv.total_amount AS NUMERIC) as "totalAmount",
        COALESCE(netoff.net_off_amount, 0) as "paidAmount",
        GREATEST(0, CAST(inv.total_amount AS NUMERIC) - COALESCE(netoff.net_off_amount, 0)) as "balanceAmount",
        GREATEST(0, (CURRENT_DATE - inv.invoice_date::date)) as "agingDays",
        inv.status,
        inv.tax_invoice_status as "taxInvoiceStatus",
        inv.description
      FROM erp_invoices inv
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) as net_off_amount
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) netoff ON netoff.invoice_id = inv.id
      WHERE inv.is_deleted = false 
        AND (inv.tax_invoice_status IS NULL OR inv.tax_invoice_status != 4)
    `;

    if (direction === 'IN') {
      if (taxCode === 'KHONG_MST' || !taxCode) {
        query += ` AND inv.direction = 'IN' AND (inv.seller_tax_code IS NULL OR inv.seller_tax_code = '')`;
      } else {
        query += ` AND inv.direction = 'IN' AND inv.seller_tax_code = '${taxCode.replace(/'/g, "''")}'`;
      }
      if (partnerName && partnerName.trim()) {
        const cleanName = partnerName.trim().replace(/'/g, "''");
        query += ` AND COALESCE(NULLIF(TRIM(inv.seller_name), ''), 'Nhà cung cấp') = '${cleanName}'`;
      }
    } else {
      if (taxCode === 'KHONG_MST' || !taxCode) {
        query += ` AND inv.direction = 'OUT' AND (inv.buyer_tax_code IS NULL OR inv.buyer_tax_code = '') AND (inv.buyer_cccd IS NULL OR inv.buyer_cccd = '')`;
      } else {
        query += ` AND inv.direction = 'OUT' AND (inv.buyer_tax_code = '${taxCode.replace(/'/g, "''")}' OR inv.buyer_cccd = '${taxCode.replace(/'/g, "''")}')`;
      }
      if (partnerName && partnerName.trim()) {
        const cleanName = partnerName.trim().replace(/'/g, "''");
        query += ` AND COALESCE(NULLIF(TRIM(inv.buyer_name), ''), NULLIF(TRIM(inv.buyer_personal_name), ''), 'Khách hàng lẻ') = '${cleanName}'`;
      }
    }

    if (dateFrom) {
      query += ` AND inv.invoice_date >= '${dateFrom.replace(/'/g, "''")}'`;
    }
    if (dateTo) {
      const effTo = dateTo.length === 10 ? `${dateTo} 23:59:59.999` : dateTo;
      query += ` AND inv.invoice_date <= '${effTo.replace(/'/g, "''")}'`;
    }

    query += ` ORDER BY inv.invoice_date DESC`;

    const rawData = await this.invoiceRepo.query(query);

    return rawData.map((r: any) => ({
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
    const workbook = new Workbook();
    workbook.creator = 'Liouni ERP';
    workbook.created = new Date();

    const partnerType = queryDto.partner_type || InvoicePartnerType.CUSTOMER;
    const isSupplier = partnerType === InvoicePartnerType.SUPPLIER;
    const direction = isSupplier ? 'IN' : 'OUT';

    options?.onProgress?.(10, 100, 'Đang truy vấn dữ liệu công nợ...');

    // 1. Truy vấn danh sách tổng hợp công nợ (lấy toàn bộ)
    const debtsResponse = await this.getDebts({
      ...queryDto,
      page: 1,
      pageSize: 100000,
    });
    const partners = debtsResponse.items || [];
    const summary = debtsResponse.summary;

    options?.onProgress?.(40, 100, 'Đang truy vấn chi tiết hóa đơn...');

    // 2. Truy vấn danh sách chi tiết hóa đơn theo bộ lọc
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

    const detailedInvoices = await this.invoiceRepo.query(
      detailedInvoicesQuery,
    );

    options?.onProgress?.(65, 100, 'Đang khởi tạo các trang tính Excel...');

    // ── SHEET 1: TỔNG HỢP CÔNG NỢ & TUỔI NỢ ──────────────────────────────
    const sheet1Title = isSupplier
      ? 'Tổng hợp công nợ NCC'
      : 'Tổng hợp công nợ KH';
    const sheet1 = workbook.addWorksheet(sheet1Title);

    // Tiêu đề báo cáo
    sheet1.addRow([
      `BÁO CÁO TỔNG HỢP CÔNG NỢ & PHÂN TẦNG TUỔI NỢ ${isSupplier ? 'NHÀ CUNG CẤP (PHẢI TRẢ)' : 'KHÁCH HÀNG (PHẢI THU)'}`,
    ]);
    sheet1.addRow([
      `Khoảng thời gian: ${queryDto.date_from || 'Đầu kỳ'} - ${queryDto.date_to || 'Hiện tại'}`,
    ]);
    sheet1.addRow([
      `Ngày xuất: ${new Date().toLocaleString('vi-VN')} | Tổng số đối tác: ${partners.length}`,
    ]);
    sheet1.addRow([]); // Blank line

    const titleRow = sheet1.getRow(1);
    titleRow.font = {
      name: 'Calibri',
      size: 14,
      bold: true,
      color: { argb: 'FF1E293B' },
    };
    sheet1.getRow(2).font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF475569' },
    };
    sheet1.getRow(3).font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF64748B' },
    };

    // Cấu hình bảng dữ liệu
    const headerRowIndex = 5;
    const headers = [
      'STT',
      isSupplier ? 'Tên nhà cung cấp' : 'Tên khách hàng',
      'Mã số thuế / CCCD',
      'Địa chỉ',
      'SL Hóa đơn',
      isSupplier ? 'Tổng phải trả' : 'Tổng phải thu',
      isSupplier ? 'Đã trả' : 'Đã thu',
      isSupplier ? 'Còn phải trả' : 'Còn phải thu',
      'Nợ 0-30 ngày',
      'Nợ 31-60 ngày',
      'Nợ 61-90 ngày',
      'Nợ >90 ngày',
      'Tuổi nợ max (ngày)',
      'Tuổi nợ BQ (ngày)',
      'Đánh giá rủi ro',
      'Ngày HĐ gần nhất',
    ];

    sheet1.addRow(headers);
    const headerRow = sheet1.getRow(headerRowIndex);
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

    // Default header fill
    for (let c = 1; c <= 16; c++) {
      headerRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isSupplier ? 'FF334155' : 'FF1E3A8A' },
      };
    }

    // Specific aging header color accents
    headerRow.getCell(9).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Emerald
    };
    headerRow.getCell(10).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' }, // Amber
    };
    headerRow.getCell(11).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' }, // Orange
    };
    headerRow.getCell(12).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE11D48' }, // Rose/Red
    };

    // Độ rộng các cột
    sheet1.columns = [
      { key: 'stt', width: 8 },
      { key: 'partnerName', width: 36 },
      { key: 'taxCode', width: 18 },
      { key: 'address', width: 32 },
      { key: 'invoiceCount', width: 14 },
      { key: 'totalAmount', width: 22 },
      { key: 'paidAmount', width: 22 },
      { key: 'balanceAmount', width: 22 },
      { key: 'aging0To30', width: 22 },
      { key: 'aging31To60', width: 22 },
      { key: 'aging61To90', width: 22 },
      { key: 'agingOver90', width: 22 },
      { key: 'maxAgingDays', width: 16 },
      { key: 'weightedAgingDays', width: 16 },
      { key: 'agingCategory', width: 28 },
      { key: 'latestInvoiceDate', width: 16 },
    ];

    // Đổ dữ liệu
    partners.forEach((p, idx) => {
      const bal = Number(p.balanceAmount) || 0;
      const aging = Number(p.maxAgingDays) || 0;
      const weightedAging = Number(p.weightedAgingDays) || 0;
      const a0_30 = Number(p.aging0To30) || 0;
      const a31_60 = Number(p.aging31To60) || 0;
      const a61_90 = Number(p.aging61To90) || 0;
      const aOver90 = Number(p.agingOver90) || 0;

      let agingCategory = 'Đã tất toán (0% nợ)';
      if (bal > 0) {
        if (aOver90 > 0 && aOver90 >= bal * 0.99) {
          agingCategory = '>90 ngày (Nợ xấu / Nghiêm trọng)';
        } else if (aOver90 > 0) {
          agingCategory = 'Đa tầng (Có nợ quá hạn >90d)';
        } else if (a61_90 > 0) {
          agingCategory = '61-90 ngày (Quá hạn)';
        } else if (a31_60 > 0) {
          agingCategory = '31-60 ngày (Cần theo dõi)';
        } else {
          agingCategory = '0-30 ngày (Trong hạn 100%)';
        }
      }

      const row = sheet1.addRow([
        idx + 1,
        p.partnerName || '—',
        p.taxCode === 'KHONG_MST' ? '—' : p.taxCode,
        p.address || '—',
        Number(p.invoiceCount) || 0,
        Number(p.totalAmount) || 0,
        Number(p.paidAmount) || 0,
        bal,
        a0_30,
        a31_60,
        a61_90,
        aOver90,
        bal > 0 ? aging : 0,
        bal > 0 ? weightedAging : 0,
        agingCategory,
        p.latestInvoiceDate || '—',
      ]);

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      // Định dạng từng ô
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).numFmt = '#,##0';
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      if (bal > 0) {
        row.getCell(8).font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFDC2626' },
        };
      } else {
        row.getCell(8).font = {
          name: 'Calibri',
          size: 10,
          color: { argb: 'FF059669' },
        };
      }

      // Aging columns I, J, K, L with distinctive background colors
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(9).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }, // Light emerald
      };
      row.getCell(9).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
        bold: a0_30 > 0,
      };

      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(10).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }, // Light amber
      };
      row.getCell(10).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
        bold: a31_60 > 0,
      };

      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(11).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7ED' }, // Light orange
      };
      row.getCell(11).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
        bold: a61_90 > 0,
      };

      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(12).numFmt = '#,##0.00';
      row.getCell(12).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' }, // Light rose
      };
      row.getCell(12).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
        bold: aOver90 > 0,
      };

      row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(13).numFmt = '#,##0';
      row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(14).numFmt = '#,##0';
      row.getCell(15).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };

      // Border mỏng
      for (let c = 1; c <= 16; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    // Dòng tổng cộng Footer Sheet 1
    const lastDataRowIndex = headerRowIndex + partners.length;
    const summaryRow = sheet1.addRow([
      '',
      'TỔNG CỘNG',
      '',
      '',
      summary.totalInvoiceCount || {
        formula: `SUM(E${headerRowIndex + 1}:E${lastDataRowIndex})`,
      },
      summary.grandTotalAmount || {
        formula: `SUM(F${headerRowIndex + 1}:F${lastDataRowIndex})`,
      },
      summary.grandTotalPaid || {
        formula: `SUM(G${headerRowIndex + 1}:G${lastDataRowIndex})`,
      },
      summary.grandTotalBalance || {
        formula: `SUM(H${headerRowIndex + 1}:H${lastDataRowIndex})`,
      },
      summary.grandTotalAging0To30 ?? {
        formula: `SUM(I${headerRowIndex + 1}:I${lastDataRowIndex})`,
      },
      summary.grandTotalAging31To60 ?? {
        formula: `SUM(J${headerRowIndex + 1}:J${lastDataRowIndex})`,
      },
      summary.grandTotalAging61To90 ?? {
        formula: `SUM(K${headerRowIndex + 1}:K${lastDataRowIndex})`,
      },
      summary.grandTotalAgingOver90 ?? {
        formula: `SUM(L${headerRowIndex + 1}:L${lastDataRowIndex})`,
      },
      '',
      '',
      '',
      '',
    ]);

    summaryRow.height = 24;
    summaryRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF0F172A' },
    };
    for (let c = 1; c <= 16; c++) {
      summaryRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
    }

    summaryRow.getCell(2).alignment = {
      horizontal: 'left',
      vertical: 'middle',
    };
    summaryRow.getCell(5).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    summaryRow.getCell(5).numFmt = '#,##0';
    for (let colIdx = 6; colIdx <= 8; colIdx++) {
      summaryRow.getCell(colIdx).alignment = {
        horizontal: 'right',
        vertical: 'middle',
      };
      summaryRow.getCell(colIdx).numFmt = '#,##0.00';
    }

    // Summary aging columns styling with soft tinted background
    summaryRow.getCell(9).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(9).numFmt = '#,##0.00';
    summaryRow.getCell(9).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' },
    };
    summaryRow.getCell(9).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF065F46' },
    };

    summaryRow.getCell(10).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(10).numFmt = '#,##0.00';
    summaryRow.getCell(10).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEF3C7' },
    };
    summaryRow.getCell(10).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF92400E' },
    };

    summaryRow.getCell(11).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(11).numFmt = '#,##0.00';
    summaryRow.getCell(11).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEDD5' },
    };
    summaryRow.getCell(11).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF9A3412' },
    };

    summaryRow.getCell(12).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
    summaryRow.getCell(12).numFmt = '#,##0.00';
    summaryRow.getCell(12).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE4E6' },
    };
    summaryRow.getCell(12).font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF9F1239' },
    };

    for (let c = 1; c <= 16; c++) {
      summaryRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
    }

    sheet1.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    sheet1.autoFilter = `A${headerRowIndex}:P${lastDataRowIndex}`;

    // ── SHEET 2: CHI TIẾT HÓA ĐƠN ĐỐI TÁC ─────────────────────────────────
    options?.onProgress?.(85, 100, 'Đang điền chi tiết hóa đơn...');

    const sheet2 = workbook.addWorksheet('Chi tiết hóa đơn đối tác');
    const sheet2Headers = [
      'STT',
      'Mã số thuế',
      'Tên đối tác',
      'Ngày hóa đơn',
      'Ký hiệu HĐ',
      'Số hóa đơn',
      'Diễn giải',
      'Tiền trước thuế',
      'Thuế VAT',
      'Tổng tiền HĐ',
      'Đã thanh toán',
      'Còn lại',
      '0-30 ngày',
      '31-60 ngày',
      '61-90 ngày',
      '>90 ngày',
      'Tuổi nợ (ngày)',
      'Trạng thái',
    ];

    sheet2.addRow(sheet2Headers);
    const s2HeaderRow = sheet2.getRow(1);
    s2HeaderRow.height = 26;
    s2HeaderRow.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    s2HeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

    for (let c = 1; c <= 18; c++) {
      s2HeaderRow.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' },
      };
    }

    // Specific aging header color accents for Sheet 2
    s2HeaderRow.getCell(13).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Emerald
    };
    s2HeaderRow.getCell(14).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD97706' }, // Amber
    };
    s2HeaderRow.getCell(15).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEA580C' }, // Orange
    };
    s2HeaderRow.getCell(16).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE11D48' }, // Rose
    };

    sheet2.columns = [
      { key: 'stt', width: 8 },
      { key: 'taxCode', width: 18 },
      { key: 'partnerName', width: 35 },
      { key: 'invoiceDate', width: 15 },
      { key: 'serialNo', width: 14 },
      { key: 'invoiceNo', width: 16 },
      { key: 'description', width: 36 },
      { key: 'preVatAmount', width: 20 },
      { key: 'vatAmount', width: 18 },
      { key: 'totalAmount', width: 22 },
      { key: 'paidAmount', width: 20 },
      { key: 'balanceAmount', width: 20 },
      { key: 'aging0To30', width: 18 },
      { key: 'aging31To60', width: 18 },
      { key: 'aging61To90', width: 18 },
      { key: 'agingOver90', width: 18 },
      { key: 'agingDays', width: 14 },
      { key: 'status', width: 15 },
    ];

    detailedInvoices.forEach((inv: any, idx: number) => {
      const pName = isSupplier ? inv.sellerName : inv.buyerName;
      const tCode = isSupplier ? inv.sellerTaxCode : inv.buyerTaxCode;
      const bal = Number(inv.balanceAmount) || 0;
      const aging = Number(inv.agingDays) || 0;

      const a0_30 = bal > 0 && aging <= 30 ? bal : 0;
      const a31_60 = bal > 0 && aging > 30 && aging <= 60 ? bal : 0;
      const a61_90 = bal > 0 && aging > 60 && aging <= 90 ? bal : 0;
      const aOver90 = bal > 0 && aging > 90 ? bal : 0;

      const row = sheet2.addRow([
        idx + 1,
        tCode === 'KHONG_MST' ? '—' : tCode,
        pName || '—',
        inv.invoiceDate,
        inv.serialNo || '—',
        inv.invoiceNo || '—',
        inv.description || '—',
        Number(inv.preVatAmount) || 0,
        Number(inv.vatAmount) || 0,
        Number(inv.totalAmount) || 0,
        Number(inv.paidAmount) || 0,
        bal,
        a0_30,
        a31_60,
        a61_90,
        aOver90,
        bal > 0 ? aging : 0,
        inv.status || 'ACTIVE',
      ]);

      row.height = 20;
      row.font = { name: 'Calibri', size: 10 };

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(9).numFmt = '#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).numFmt = '#,##0.00';
      row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(11).numFmt = '#,##0.00';
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(12).numFmt = '#,##0.00';

      // Sheet 2 Aging Columns
      row.getCell(13).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(13).numFmt = '#,##0.00';
      row.getCell(13).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' },
      };
      row.getCell(13).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a0_30 > 0 ? 'FF065F46' : 'FF94A3B8' },
        bold: a0_30 > 0,
      };

      row.getCell(14).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(14).numFmt = '#,##0.00';
      row.getCell(14).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' },
      };
      row.getCell(14).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a31_60 > 0 ? 'FF92400E' : 'FF94A3B8' },
        bold: a31_60 > 0,
      };

      row.getCell(15).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(15).numFmt = '#,##0.00';
      row.getCell(15).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF7ED' },
      };
      row.getCell(15).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: a61_90 > 0 ? 'FF9A3412' : 'FF94A3B8' },
        bold: a61_90 > 0,
      };

      row.getCell(16).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(16).numFmt = '#,##0.00';
      row.getCell(16).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF1F2' },
      };
      row.getCell(16).font = {
        name: 'Calibri',
        size: 10,
        color: { argb: aOver90 > 0 ? 'FF9F1239' : 'FF94A3B8' },
        bold: aOver90 > 0,
      };

      row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(17).numFmt = '#,##0';
      row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };

      for (let c = 1; c <= 18; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    sheet2.views = [{ state: 'frozen', ySplit: 1 }];
    sheet2.autoFilter = `A1:R${detailedInvoices.length + 1}`;

    options?.onProgress?.(100, 100, 'Đang xuất tệp Excel hoàn chỉnh...');
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
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
