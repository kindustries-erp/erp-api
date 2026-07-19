import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WarehouseVoucherQueryDto } from '../dto/warehouse-voucher-query.dto';

@Injectable()
export class InventoryWarehouseVoucherService {
  constructor(private readonly dataSource: DataSource) {}

  async listWarehouseVouchers(query: WarehouseVoucherQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const params: any[] = [];
    let pIndex = 1;

    let receiptWhere = `g.is_deleted = false`;
    let issueWhere = `g.is_deleted = false`;

    if (query.dateFrom) {
      receiptWhere += ` AND g.receipt_date >= $${pIndex}`;
      issueWhere += ` AND g.issue_date >= $${pIndex}`;
      params.push(query.dateFrom);
      pIndex++;
    }
    if (query.dateTo) {
      receiptWhere += ` AND g.receipt_date <= $${pIndex}`;
      issueWhere += ` AND g.issue_date <= $${pIndex}`;
      params.push(
        query.dateTo.length === 10
          ? `${query.dateTo} 23:59:59.999`
          : query.dateTo,
      );
      pIndex++;
    }
    if (query.status) {
      receiptWhere += ` AND g.status = $${pIndex}`;
      issueWhere += ` AND g.status = $${pIndex}`;
      params.push(query.status);
      pIndex++;
    }
    if (query.partnerId) {
      receiptWhere += ` AND g.supplier_id = $${pIndex}`;
      issueWhere += ` AND g.customer_id = $${pIndex}`;
      params.push(query.partnerId);
      pIndex++;
    }
    if (query.search) {
      const s = `%${query.search}%`;
      receiptWhere += ` AND (g.receipt_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      issueWhere += ` AND (g.issue_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      params.push(s);
      pIndex++;
    }

    const typeFilter = query.type;
    const includeReceipts =
      !typeFilter || typeFilter === 'all' || typeFilter === 'receipt';
    const includeIssues =
      !typeFilter || typeFilter === 'all' || typeFilter === 'issue';

    const queries: string[] = [];

    if (includeReceipts) {
      queries.push(`
        SELECT g.id, g.receipt_no as "voucherNo", g.receipt_date as "date", 'receipt' as "type",
               g.status, g.remarks, g.supplier_id as "partnerId", COALESCE(bp.display_name, bp.name) as "partnerName",
               g.created_at as "createdAt",
               po.po_no as "poNo",
               (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id) as "totalQty"
        FROM public.erp_goods_receipts g
        LEFT JOIN public.erp_business_partners bp ON g.supplier_id = bp.id
        LEFT JOIN public.erp_purchase_orders po ON g.purchase_order_id = po.id
        WHERE ${receiptWhere}
      `);
    }

    if (includeIssues) {
      queries.push(`
        SELECT g.id, g.issue_no as "voucherNo", g.issue_date as "date", 'issue' as "type",
               g.status, g.remarks, g.customer_id as "partnerId", COALESCE(bp.display_name, bp.name) as "partnerName",
               g.created_at as "createdAt",
               NULL as "poNo",
               (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id) as "totalQty"
        FROM public.erp_goods_issues g
        LEFT JOIN public.erp_business_partners bp ON g.customer_id = bp.id
        WHERE ${issueWhere}
      `);
    }

    if (queries.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const unionQuery = queries.join(' UNION ALL ');

    // Sorting
    let sortColumn = 'date';
    let sortDirection = 'DESC';

    if (query.sort) {
      let sortField = query.sort;
      if (sortField.startsWith('-')) {
        sortDirection = 'DESC';
        sortField = sortField.substring(1);
      } else {
        sortDirection = 'ASC';
      }
      if (sortField === 'date') sortColumn = '"date"';
      else if (sortField === 'voucherNo') sortColumn = '"voucherNo"';
      else if (sortField === 'status') sortColumn = 'status';
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${unionQuery}) as combined`;
    const dataQuery = `
      SELECT * FROM (${unionQuery}) as combined
      ORDER BY ${sortColumn} ${sortDirection}, "createdAt" DESC
      LIMIT $${pIndex} OFFSET $${pIndex + 1}
    `;

    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0]?.total ?? '0', 10);

    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const items = await this.dataSource.query(dataQuery, dataParams);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
