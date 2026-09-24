import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import {
  GetInvoiceDebtsQueryDto,
  GetInvoiceDebtColumnOptionsQueryDto,
  InvoicePartnerType,
} from '../../dto/get-invoice-debts.dto';
import {
  InvoiceDebtItem,
  InvoiceDebtSummary,
  InvoiceDebtsResponse,
  ColumnOptionItem,
  ColumnOptionsResponse,
} from '../invoice-debts.service';

@Injectable()
export class InvoiceDebtsQueryService {
  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
  ) {}

  /**
   * Helper: Xây dựng mệnh đề SQL cho Exact search ("...") và Multi-search (;)
   */
  buildKeywordSqlClause(sqlField: string, searchString: string): string | null {
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
}
