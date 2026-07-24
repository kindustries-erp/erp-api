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
    let adjustmentWhere = `g.is_deleted = false`;

    if (query.dateFrom) {
      receiptWhere += ` AND g.receipt_date >= $${pIndex}`;
      issueWhere += ` AND g.issue_date >= $${pIndex}`;
      adjustmentWhere += ` AND g.adjustment_date >= $${pIndex}`;
      params.push(query.dateFrom);
      pIndex++;
    }
    if (query.dateTo) {
      receiptWhere += ` AND g.receipt_date <= $${pIndex}`;
      issueWhere += ` AND g.issue_date <= $${pIndex}`;
      adjustmentWhere += ` AND g.adjustment_date <= $${pIndex}`;
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
      adjustmentWhere += ` AND g.status = $${pIndex}`;
      params.push(query.status);
      pIndex++;
    }
    if (query.partnerId) {
      receiptWhere += ` AND g.supplier_id = $${pIndex}`;
      issueWhere += ` AND g.customer_id = $${pIndex}`;
      adjustmentWhere += ` AND 1 = 0`; // Adjustments don't have partner
      params.push(query.partnerId);
      pIndex++;
    }
    if (query.search) {
      const s = `%${query.search}%`;
      receiptWhere += ` AND (g.receipt_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      issueWhere += ` AND (g.issue_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex} OR bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
      adjustmentWhere += ` AND (g.adjustment_no ILIKE $${pIndex} OR g.remarks ILIKE $${pIndex})`;
      params.push(s);
      pIndex++;
    }

    // Process column_search
    if (query.column_search) {
      try {
        const colSearch = JSON.parse(query.column_search);
        for (const [key, value] of Object.entries(colSearch)) {
          if (typeof value !== 'string' || !value.trim()) continue;
          const s = `%${value.trim()}%`;
          if (key === 'voucherNo') {
            receiptWhere += ` AND g.receipt_no ILIKE $${pIndex}`;
            issueWhere += ` AND g.issue_no ILIKE $${pIndex}`;
            adjustmentWhere += ` AND g.adjustment_no ILIKE $${pIndex}`;
            params.push(s);
            pIndex++;
          } else if (key === 'poNo') {
            receiptWhere += ` AND po.po_no ILIKE $${pIndex}`;
            issueWhere += ` AND 1 = 0`; // no poNo in issues
            adjustmentWhere += ` AND 1 = 0`; // no poNo in adjustments
            params.push(s);
            pIndex++;
          } else if (key === 'partnerName') {
            receiptWhere += ` AND (bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
            issueWhere += ` AND (bp.name ILIKE $${pIndex} OR bp.display_name ILIKE $${pIndex})`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(s);
            pIndex++;
          } else if (key === 'remarks') {
            receiptWhere += ` AND g.remarks ILIKE $${pIndex}`;
            issueWhere += ` AND g.remarks ILIKE $${pIndex}`;
            adjustmentWhere += ` AND g.remarks ILIKE $${pIndex}`;
            params.push(s);
            pIndex++;
          } else if (key === 'date') {
            // handle date search (e.g., partial date match)
            receiptWhere += ` AND TO_CHAR(g.receipt_date, 'YYYY-MM-DD') ILIKE $${pIndex}`;
            issueWhere += ` AND TO_CHAR(g.issue_date, 'YYYY-MM-DD') ILIKE $${pIndex}`;
            adjustmentWhere += ` AND TO_CHAR(g.adjustment_date, 'YYYY-MM-DD') ILIKE $${pIndex}`;
            params.push(s);
            pIndex++;
          } else if (key === 'qtyReceipt') {
            receiptWhere += ` AND (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text ILIKE $${pIndex}`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(s);
            pIndex++;
          } else if (key === 'qtyIssue') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text ILIKE $${pIndex}`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(s);
            pIndex++;
          } else if (key === 'qtyAdjustment') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text ILIKE $${pIndex}`;
            params.push(s);
            pIndex++;
          } else if (key === 'status') {
            receiptWhere += ` AND g.status ILIKE $${pIndex}`;
            issueWhere += ` AND g.status ILIKE $${pIndex}`;
            adjustmentWhere += ` AND g.status ILIKE $${pIndex}`;
            params.push(s);
            pIndex++;
          }
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }

    // Process column_filters
    if (query.column_filters) {
      try {
        const colFilters = JSON.parse(query.column_filters);
        for (const [key, values] of Object.entries(colFilters)) {
          if (!Array.isArray(values) || values.length === 0) continue;

          if (key === 'voucherNo') {
            receiptWhere += ` AND g.receipt_no = ANY($${pIndex})`;
            issueWhere += ` AND g.issue_no = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.adjustment_no = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'poNo') {
            receiptWhere += ` AND po.po_no = ANY($${pIndex})`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values);
            pIndex++;
          } else if (key === 'partnerName') {
            receiptWhere += ` AND COALESCE(bp.display_name, bp.name) = ANY($${pIndex})`;
            issueWhere += ` AND COALESCE(bp.display_name, bp.name) = ANY($${pIndex})`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values);
            pIndex++;
          } else if (key === 'remarks') {
            receiptWhere += ` AND g.remarks = ANY($${pIndex})`;
            issueWhere += ` AND g.remarks = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.remarks = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'status') {
            receiptWhere += ` AND g.status = ANY($${pIndex})`;
            issueWhere += ` AND g.status = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.status = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'date') {
            receiptWhere += ` AND TO_CHAR(g.receipt_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            issueWhere += ` AND TO_CHAR(g.issue_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            adjustmentWhere += ` AND TO_CHAR(g.adjustment_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'qtyReceipt') {
            receiptWhere += ` AND (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text = ANY($${pIndex})`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
            // Note: quantity values are usually numbers, but filter values from frontend are strings. We cast to text.
            params.push(values.map((v) => String(v)));
            pIndex++;
          } else if (key === 'qtyIssue') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text = ANY($${pIndex})`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values.map((v) => String(v)));
            pIndex++;
          } else if (key === 'qtyAdjustment') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text = ANY($${pIndex})`;
            params.push(values.map((v) => String(v)));
            pIndex++;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    const typeFilter = query.type;
    const includeReceipts =
      !typeFilter || typeFilter === 'all' || typeFilter === 'receipt';
    const includeIssues =
      !typeFilter || typeFilter === 'all' || typeFilter === 'issue';
    const includeAdjustments =
      !typeFilter || typeFilter === 'all' || typeFilter === 'adjustment';

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

    if (includeAdjustments) {
      queries.push(`
        SELECT g.id, g.adjustment_no as "voucherNo", g.adjustment_date as "date", 'adjustment' as "type",
               g.status, g.remarks, NULL as "partnerId", NULL as "partnerName",
               g.created_at as "createdAt",
               NULL as "poNo",
               (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id) as "totalQty"
        FROM public.erp_inventory_adjustments g
        WHERE ${adjustmentWhere}
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

      const sortMap: Record<string, string> = {
        date: '"date"',
        voucherNo: '"voucherNo"',
        status: 'status',
        poNo: '"poNo"',
        partnerName: '"partnerName"',
        remarks: 'remarks',
        qtyReceipt: '"totalQty"',
        qtyIssue: '"totalQty"',
        qtyAdjustment: '"totalQty"',
      };

      if (sortMap[sortField]) {
        sortColumn = sortMap[sortField];
      }
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

  async getWarehouseVoucherColumnOptions(
    column: string,
    search: string,
    page: number,
    pageSize: number,
    filtersStr?: string,
    type?: string,
  ) {
    const params: any[] = [];
    let pIndex = 1;

    let receiptWhere = `g.is_deleted = false`;
    let issueWhere = `g.is_deleted = false`;
    let adjustmentWhere = `g.is_deleted = false`;

    if (filtersStr) {
      try {
        const colFilters = JSON.parse(filtersStr);
        for (const [key, values] of Object.entries(colFilters)) {
          if (!Array.isArray(values) || values.length === 0) continue;
          if (key === column) continue; // don't filter on the column being queried

          if (key === 'voucherNo') {
            receiptWhere += ` AND g.receipt_no = ANY($${pIndex})`;
            issueWhere += ` AND g.issue_no = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.adjustment_no = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'poNo') {
            receiptWhere += ` AND po.po_no = ANY($${pIndex})`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values);
            pIndex++;
          } else if (key === 'partnerName') {
            receiptWhere += ` AND COALESCE(bp.display_name, bp.name) = ANY($${pIndex})`;
            issueWhere += ` AND COALESCE(bp.display_name, bp.name) = ANY($${pIndex})`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values);
            pIndex++;
          } else if (key === 'remarks') {
            receiptWhere += ` AND g.remarks = ANY($${pIndex})`;
            issueWhere += ` AND g.remarks = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.remarks = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'status') {
            receiptWhere += ` AND g.status = ANY($${pIndex})`;
            issueWhere += ` AND g.status = ANY($${pIndex})`;
            adjustmentWhere += ` AND g.status = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'date') {
            receiptWhere += ` AND TO_CHAR(g.receipt_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            issueWhere += ` AND TO_CHAR(g.issue_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            adjustmentWhere += ` AND TO_CHAR(g.adjustment_date, 'YYYY-MM-DD') = ANY($${pIndex})`;
            params.push(values);
            pIndex++;
          } else if (key === 'qtyReceipt') {
            receiptWhere += ` AND (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text = ANY($${pIndex})`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values.map((v) => String(v)));
            pIndex++;
          } else if (key === 'qtyIssue') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text = ANY($${pIndex})`;
            adjustmentWhere += ` AND 1 = 0`;
            params.push(values.map((v) => String(v)));
            pIndex++;
          } else if (key === 'qtyAdjustment') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text = ANY($${pIndex})`;
            params.push(values.map((v) => String(v)));
            pIndex++;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    const includeReceipts =
      (!type || type === 'all' || type === 'receipt') &&
      column !== 'qtyIssue' &&
      column !== 'qtyAdjustment';
    const includeIssues =
      (!type || type === 'all' || type === 'issue') &&
      column !== 'qtyReceipt' &&
      column !== 'qtyAdjustment';
    const includeAdjustments =
      (!type || type === 'all' || type === 'adjustment') &&
      column !== 'qtyReceipt' &&
      column !== 'qtyIssue';

    let selectExpr = '';

    if (column === 'voucherNo') {
      selectExpr = `
        ${includeReceipts ? `SELECT g.receipt_no as val FROM public.erp_goods_receipts g WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT g.issue_no as val FROM public.erp_goods_issues g WHERE ${issueWhere}` : ''}
        ${(includeReceipts || includeIssues) && includeAdjustments ? 'UNION ALL' : ''}
        ${includeAdjustments ? `SELECT g.adjustment_no as val FROM public.erp_inventory_adjustments g WHERE ${adjustmentWhere}` : ''}
      `;
    } else if (column === 'poNo') {
      selectExpr = `
        ${includeReceipts ? `SELECT po.po_no as val FROM public.erp_goods_receipts g LEFT JOIN public.erp_purchase_orders po ON g.purchase_order_id = po.id WHERE ${receiptWhere}` : ''}
      `;
    } else if (column === 'partnerName') {
      selectExpr = `
        ${includeReceipts ? `SELECT COALESCE(bp.display_name, bp.name) as val FROM public.erp_goods_receipts g LEFT JOIN public.erp_business_partners bp ON g.supplier_id = bp.id WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT COALESCE(bp.display_name, bp.name) as val FROM public.erp_goods_issues g LEFT JOIN public.erp_business_partners bp ON g.customer_id = bp.id WHERE ${issueWhere}` : ''}
      `;
    } else if (column === 'remarks') {
      selectExpr = `
        ${includeReceipts ? `SELECT g.remarks as val FROM public.erp_goods_receipts g WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT g.remarks as val FROM public.erp_goods_issues g WHERE ${issueWhere}` : ''}
        ${(includeReceipts || includeIssues) && includeAdjustments ? 'UNION ALL' : ''}
        ${includeAdjustments ? `SELECT g.remarks as val FROM public.erp_inventory_adjustments g WHERE ${adjustmentWhere}` : ''}
      `;
    } else if (column === 'status') {
      selectExpr = `
        ${includeReceipts ? `SELECT g.status as val FROM public.erp_goods_receipts g WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT g.status as val FROM public.erp_goods_issues g WHERE ${issueWhere}` : ''}
        ${(includeReceipts || includeIssues) && includeAdjustments ? 'UNION ALL' : ''}
        ${includeAdjustments ? `SELECT g.status as val FROM public.erp_inventory_adjustments g WHERE ${adjustmentWhere}` : ''}
      `;
    } else if (column === 'date') {
      selectExpr = `
        ${includeReceipts ? `SELECT TO_CHAR(g.receipt_date, 'YYYY-MM-DD') as val FROM public.erp_goods_receipts g WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT TO_CHAR(g.issue_date, 'YYYY-MM-DD') as val FROM public.erp_goods_issues g WHERE ${issueWhere}` : ''}
        ${(includeReceipts || includeIssues) && includeAdjustments ? 'UNION ALL' : ''}
        ${includeAdjustments ? `SELECT TO_CHAR(g.adjustment_date, 'YYYY-MM-DD') as val FROM public.erp_inventory_adjustments g WHERE ${adjustmentWhere}` : ''}
      `;
    } else if (column === 'qtyReceipt' && includeReceipts) {
      selectExpr = `SELECT (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text as val FROM public.erp_goods_receipts g WHERE ${receiptWhere}`;
    } else if (column === 'qtyIssue' && includeIssues) {
      selectExpr = `SELECT (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text as val FROM public.erp_goods_issues g WHERE ${issueWhere}`;
    } else if (column === 'qtyAdjustment' && includeAdjustments) {
      selectExpr = `SELECT (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text as val FROM public.erp_inventory_adjustments g WHERE ${adjustmentWhere}`;
    }

    if (!selectExpr.trim()) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let unionQuery = `
      SELECT val FROM (${selectExpr}) t
      WHERE val IS NOT NULL AND val::text != ''
    `;

    if (search) {
      unionQuery += ` AND val::text ILIKE $${pIndex}`;
      params.push(`%${search}%`);
      pIndex++;
    }

    const countQuery = `SELECT COUNT(DISTINCT val) as total FROM (${unionQuery}) as sq`;
    const dataQuery = `
      SELECT DISTINCT val FROM (${unionQuery}) as sq
      ORDER BY val ASC
      LIMIT $${pIndex} OFFSET $${pIndex + 1}
    `;

    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0]?.total ?? '0', 10);

    const dataParams = [...params, pageSize, (page - 1) * pageSize];
    const items = await this.dataSource.query(dataQuery, dataParams);

    return {
      items: items.map((i: any) => i.val),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
