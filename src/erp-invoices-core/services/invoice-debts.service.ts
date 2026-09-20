import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  latestInvoiceDate: string | null;
}

export interface InvoiceDebtSummary {
  totalPartners: number;
  totalInvoiceCount: number;
  grandTotalAmount: number;
  grandTotalPaid: number;
  grandTotalBalance: number;
  cumulativeTotalAmount?: number;
  cumulativePaidAmount?: number;
  cumulativeBalanceAmount?: number;
  cumulativeInvoiceCount?: number;
  cumulativePartnersCount?: number;
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
                agingConds.push(
                  `(p."maxAgingDays" >= 0 AND p."maxAgingDays" <= 30 AND p."balanceAmount" > 0)`,
                );
              } else if (v === '31-60') {
                agingConds.push(
                  `(p."maxAgingDays" > 30 AND p."maxAgingDays" <= 60 AND p."balanceAmount" > 0)`,
                );
              } else if (v === '61-90') {
                agingConds.push(
                  `(p."maxAgingDays" > 60 AND p."maxAgingDays" <= 90 AND p."balanceAmount" > 0)`,
                );
              } else if (v === '>90') {
                agingConds.push(
                  `(p."maxAgingDays" > 90 AND p."balanceAmount" > 0)`,
                );
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
        COALESCE(SUM(p."balanceAmount"), 0) as "grandTotalBalance"
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
      latestInvoiceDate: r.latestInvoiceDate || null,
    }));

    const totalPages = Math.ceil(total / safePageSize);

    // Calculate Cumulative Totals for Multi-page Navigation
    let cumulativeTotalAmount = 0;
    let cumulativePaidAmount = 0;
    let cumulativeBalanceAmount = 0;
    let cumulativeInvoiceCount = 0;
    let cumulativePartnersCount = 0;

    if (page === 1) {
      for (const item of items) {
        cumulativeTotalAmount += item.totalAmount;
        cumulativePaidAmount += item.paidAmount;
        cumulativeBalanceAmount += item.balanceAmount;
        cumulativeInvoiceCount += item.invoiceCount;
      }
      cumulativePartnersCount = items.length;
    } else if (page >= totalPages) {
      cumulativeTotalAmount = summary.grandTotalAmount;
      cumulativePaidAmount = summary.grandTotalPaid;
      cumulativeBalanceAmount = summary.grandTotalBalance;
      cumulativeInvoiceCount = summary.totalInvoiceCount;
      cumulativePartnersCount = total;
    } else {
      const cumSql = `
        SELECT 
          COUNT(*) as "cumulativePartnersCount",
          COALESCE(SUM(p."invoiceCount"), 0) as "cumulativeInvoiceCount",
          COALESCE(SUM(p."totalAmount"), 0) as "cumulativeTotalAmount",
          COALESCE(SUM(p."paidAmount"), 0) as "cumulativePaidAmount",
          COALESCE(SUM(p."balanceAmount"), 0) as "cumulativeBalanceAmount"
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
    }

    summary.cumulativeTotalAmount = cumulativeTotalAmount;
    summary.cumulativePaidAmount = cumulativePaidAmount;
    summary.cumulativeBalanceAmount = cumulativeBalanceAmount;
    summary.cumulativeInvoiceCount = cumulativeInvoiceCount;
    summary.cumulativePartnersCount = cumulativePartnersCount;

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
