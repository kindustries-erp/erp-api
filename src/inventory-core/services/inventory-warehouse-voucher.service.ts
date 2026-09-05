import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WarehouseVoucherQueryDto } from '../dto/warehouse-voucher-query.dto';

interface KeywordCondition {
  isExact: boolean;
  keyword: string;
}

function parseMultiKeywordSearch(searchString: string): KeywordCondition[] {
  if (!searchString) return [];
  return searchString
    .split(';')
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map((k) => {
      let isExact = false;
      let cleanKw = k;
      if (k.startsWith('"') && k.endsWith('"') && k.length >= 2) {
        isExact = true;
        cleanKw = k.slice(1, -1);
      }
      return { isExact, keyword: cleanKw };
    });
}

function buildRawMultiKeywordSql(
  fields: string[],
  searchString: string,
  params: any[],
  getPIndex: () => number,
): string {
  const kws = parseMultiKeywordSearch(searchString);
  if (kws.length === 0) return '';

  const kwClauses = kws.map((kw) => {
    const pVal = kw.isExact ? kw.keyword : `%${kw.keyword}%`;
    const fieldClauses = fields.map((f) => {
      const idx = getPIndex();
      params.push(pVal);
      return `${f} ILIKE $${idx}`;
    });
    return fieldClauses.length === 1
      ? fieldClauses[0]
      : `(${fieldClauses.join(' OR ')})`;
  });

  return `(${kwClauses.join(' OR ')})`;
}

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

    const applyColSearchToWhere = (key: string, value: string) => {
      if (typeof value !== 'string' || !value.trim()) return;

      if (key === 'voucherNo') {
        const rc = buildRawMultiKeywordSql(
          ['g.receipt_no'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['g.issue_no'],
          value,
          params,
          () => pIndex++,
        );
        const ac = buildRawMultiKeywordSql(
          ['g.adjustment_no'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        if (ac) adjustmentWhere += ` AND ${ac}`;
      } else if (key === 'poNo') {
        const rc = buildRawMultiKeywordSql(
          ['po.po_no'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['so.so_no'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        adjustmentWhere += ` AND 1 = 0`;
      } else if (key === 'partnerName') {
        const rc = buildRawMultiKeywordSql(
          ['bp.name', 'bp.display_name'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['bp.name', 'bp.display_name'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        adjustmentWhere += ` AND 1 = 0`;
      } else if (key === 'remarks') {
        const rc = buildRawMultiKeywordSql(
          ['g.remarks'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['g.remarks'],
          value,
          params,
          () => pIndex++,
        );
        const ac = buildRawMultiKeywordSql(
          ['g.remarks'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        if (ac) adjustmentWhere += ` AND ${ac}`;
      } else if (key === 'date') {
        const rc = buildRawMultiKeywordSql(
          ["TO_CHAR(g.receipt_date, 'YYYY-MM-DD')"],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ["TO_CHAR(g.issue_date, 'YYYY-MM-DD')"],
          value,
          params,
          () => pIndex++,
        );
        const ac = buildRawMultiKeywordSql(
          ["TO_CHAR(g.adjustment_date, 'YYYY-MM-DD')"],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
      } else if (key === 'category' || key === 'categoryName') {
        const rc = buildRawMultiKeywordSql(
          ['cat.name', 'cat.code'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['cat.name', 'cat.code'],
          value,
          params,
          () => pIndex++,
        );
        const ac = buildRawMultiKeywordSql(
          ['cat.name', 'cat.code'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        if (ac) adjustmentWhere += ` AND ${ac}`;
      } else if (key === 'qtyReceipt') {
        const rc = buildRawMultiKeywordSql(
          [
            '(SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text',
          ],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        issueWhere += ` AND 1 = 0`;
        adjustmentWhere += ` AND 1 = 0`;
      } else if (key === 'qtyIssue') {
        receiptWhere += ` AND 1 = 0`;
        const ic = buildRawMultiKeywordSql(
          [
            '(SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text',
          ],
          value,
          params,
          () => pIndex++,
        );
        if (ic) issueWhere += ` AND ${ic}`;
        adjustmentWhere += ` AND 1 = 0`;
      } else if (key === 'qtyAdjustment') {
        receiptWhere += ` AND 1 = 0`;
        issueWhere += ` AND 1 = 0`;
        const ac = buildRawMultiKeywordSql(
          [
            '(SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text',
          ],
          value,
          params,
          () => pIndex++,
        );
        if (ac) adjustmentWhere += ` AND ${ac}`;
      } else if (key === 'status') {
        const rc = buildRawMultiKeywordSql(
          ['g.status'],
          value,
          params,
          () => pIndex++,
        );
        const ic = buildRawMultiKeywordSql(
          ['g.status'],
          value,
          params,
          () => pIndex++,
        );
        const ac = buildRawMultiKeywordSql(
          ['g.status'],
          value,
          params,
          () => pIndex++,
        );
        if (rc) receiptWhere += ` AND ${rc}`;
        if (ic) issueWhere += ` AND ${ic}`;
        if (ac) adjustmentWhere += ` AND ${ac}`;
      } else if (key === 'type') {
        const kws = parseMultiKeywordSearch(value);
        let matchReceipt = false;
        let matchIssue = false;
        let matchAdjustment = false;
        for (const kw of kws) {
          const s_raw = kw.keyword.toLowerCase();
          if (
            'receipt'.includes(s_raw) ||
            'nhập kho'.includes(s_raw) ||
            'nhap kho'.includes(s_raw) ||
            'nhap'.includes(s_raw)
          )
            matchReceipt = true;
          if (
            'issue'.includes(s_raw) ||
            'xuất kho'.includes(s_raw) ||
            'xuat kho'.includes(s_raw) ||
            'xuat'.includes(s_raw)
          )
            matchIssue = true;
          if (
            'adjustment'.includes(s_raw) ||
            'điều chỉnh'.includes(s_raw) ||
            'dieu chinh'.includes(s_raw)
          )
            matchAdjustment = true;
        }
        if (!matchReceipt) receiptWhere += ' AND 1 = 0';
        if (!matchIssue) issueWhere += ' AND 1 = 0';
        if (!matchAdjustment) adjustmentWhere += ' AND 1 = 0';
      }
    };

    if (query.search) {
      const s = query.search;
      const receiptSearch = buildRawMultiKeywordSql(
        ['g.receipt_no', 'g.remarks', 'bp.name', 'bp.display_name'],
        s,
        params,
        () => pIndex++,
      );
      const issueSearch = buildRawMultiKeywordSql(
        ['g.issue_no', 'g.remarks', 'bp.name', 'bp.display_name'],
        s,
        params,
        () => pIndex++,
      );
      const adjustmentSearch = buildRawMultiKeywordSql(
        ['g.adjustment_no', 'g.remarks'],
        s,
        params,
        () => pIndex++,
      );
      receiptWhere += ` AND ${receiptSearch}`;
      issueWhere += ` AND ${issueSearch}`;
      adjustmentWhere += ` AND ${adjustmentSearch}`;
    }

    // Process column_search
    if (query.column_search) {
      try {
        const colSearch = JSON.parse(query.column_search);
        for (const [key, value] of Object.entries(colSearch)) {
          applyColSearchToWhere(key, value as string);
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

          // 1. Check __ALL_MATCHING__
          if (values[0] === '__ALL_MATCHING__') {
            const searchStr = values[1] || '';
            if (searchStr) {
              applyColSearchToWhere(key, searchStr);
            }
            continue;
          }

          // 2. Check __BLANK__
          const hasBlank = values.includes('__BLANK__');
          const nonBlank = values.filter((v) => v !== '__BLANK__');

          const applyAnyOrBlank = (fieldSql: string): string => {
            if (hasBlank && nonBlank.length > 0) {
              const idx = pIndex++;
              params.push(nonBlank);
              return `(${fieldSql} = ANY($${idx}) OR ${fieldSql} IS NULL OR ${fieldSql}::text = '')`;
            } else if (hasBlank) {
              return `(${fieldSql} IS NULL OR ${fieldSql}::text = '')`;
            } else {
              const idx = pIndex++;
              params.push(nonBlank);
              return `${fieldSql} = ANY($${idx})`;
            }
          };

          if (key === 'voucherNo') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.receipt_no')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.issue_no')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.adjustment_no')}`;
          } else if (key === 'type') {
            if (!values.includes('receipt')) receiptWhere += ' AND 1 = 0';
            if (!values.includes('issue')) issueWhere += ' AND 1 = 0';
            if (!values.includes('adjustment')) adjustmentWhere += ' AND 1 = 0';
          } else if (key === 'poNo') {
            receiptWhere += ` AND ${applyAnyOrBlank('po.po_no')}`;
            issueWhere += ` AND ${applyAnyOrBlank('so.so_no')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'partnerName') {
            receiptWhere += ` AND ${applyAnyOrBlank('COALESCE(bp.display_name, bp.name)')}`;
            issueWhere += ` AND ${applyAnyOrBlank('COALESCE(bp.display_name, bp.name)')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'remarks') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
          } else if (key === 'category' || key === 'categoryName') {
            receiptWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
            issueWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
          } else if (key === 'status') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.status')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.status')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.status')}`;
          } else if (key === 'date') {
            receiptWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.receipt_date, 'YYYY-MM-DD')")}`;
            issueWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.issue_date, 'YYYY-MM-DD')")}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.adjustment_date, 'YYYY-MM-DD')")}`;
          } else if (key === 'qtyReceipt') {
            receiptWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text')}`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'qtyIssue') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'qtyAdjustment') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text')}`;
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
               g.purchase_order_id as "purchaseOrderId",
               NULL as "salesOrderId",
               g.category_id as "categoryId",
               cat.name as "categoryName",
               cat.code as "categoryCode",
               (SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id) as "totalQty"
        FROM public.erp_goods_receipts g
        LEFT JOIN public.erp_business_partners bp ON g.supplier_id = bp.id
        LEFT JOIN public.erp_purchase_orders po ON g.purchase_order_id = po.id
        LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id
        WHERE ${receiptWhere}
      `);
    }

    if (includeIssues) {
      queries.push(`
        SELECT g.id, g.issue_no as "voucherNo", g.issue_date as "date", 'issue' as "type",
               g.status, g.remarks, g.customer_id as "partnerId", COALESCE(bp.display_name, bp.name) as "partnerName",
               g.created_at as "createdAt",
               so.so_no as "poNo",
               NULL as "purchaseOrderId",
               g.sales_order_id as "salesOrderId",
               g.category_id as "categoryId",
               cat.name as "categoryName",
               cat.code as "categoryCode",
               (SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id) as "totalQty"
        FROM public.erp_goods_issues g
        LEFT JOIN public.erp_business_partners bp ON g.customer_id = bp.id
        LEFT JOIN public.erp_sales_orders so ON g.sales_order_id = so.id
        LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id
        WHERE ${issueWhere}
      `);
    }

    if (includeAdjustments) {
      queries.push(`
        SELECT g.id, g.adjustment_no as "voucherNo", g.adjustment_date as "date", 'adjustment' as "type",
               g.status, g.remarks, NULL as "partnerId", NULL as "partnerName",
               g.created_at as "createdAt",
               NULL as "poNo",
               NULL as "purchaseOrderId",
               NULL as "salesOrderId",
               g.category_id as "categoryId",
               cat.name as "categoryName",
               cat.code as "categoryCode",
               (SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id) as "totalQty"
        FROM public.erp_inventory_adjustments g
        LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id
        WHERE ${adjustmentWhere}
      `);
    }

    if (queries.length === 0) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const unionQuery = queries.join(' UNION ALL ');

    // Sorting
    let sortColumn = 'DATE("date")';
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
        date: 'DATE("date")',
        voucherNo: '"voucherNo"',
        type: '"type"',
        status: 'status',
        poNo: '"poNo"',
        partnerName: '"partnerName"',
        remarks: 'remarks',
        category: '"categoryName"',
        categoryName: '"categoryName"',
        qtyReceipt: '"totalQty"',
        qtyIssue: '"totalQty"',
        qtyAdjustment: '"totalQty"',
        createdAt: '"createdAt"',
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
    if (column === 'type') {
      const allTypes = ['receipt', 'issue', 'adjustment'];
      const filtered = search
        ? allTypes.filter((v) => {
            const s_raw = search.toLowerCase();
            return (
              v.includes(s_raw) ||
              (v === 'receipt' &&
                ('nhập kho'.includes(s_raw) ||
                  'nhap kho'.includes(s_raw) ||
                  'nhap'.includes(s_raw))) ||
              (v === 'issue' &&
                ('xuất kho'.includes(s_raw) ||
                  'xuat kho'.includes(s_raw) ||
                  'xuat'.includes(s_raw))) ||
              (v === 'adjustment' &&
                ('điều chỉnh'.includes(s_raw) || 'dieu chinh'.includes(s_raw)))
            );
          })
        : allTypes;
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        pageSize: filtered.length,
        totalPages: 1,
      };
    }

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

          // 1. Check __ALL_MATCHING__
          if (values[0] === '__ALL_MATCHING__') {
            const searchStr = values[1] || '';
            if (searchStr) {
              if (key === 'voucherNo') {
                const rc = buildRawMultiKeywordSql(
                  ['g.receipt_no'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['g.issue_no'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ac = buildRawMultiKeywordSql(
                  ['g.adjustment_no'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                if (ac) adjustmentWhere += ` AND ${ac}`;
              } else if (key === 'category' || key === 'categoryName') {
                const rc = buildRawMultiKeywordSql(
                  ['cat.name', 'cat.code'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['cat.name', 'cat.code'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ac = buildRawMultiKeywordSql(
                  ['cat.name', 'cat.code'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                if (ac) adjustmentWhere += ` AND ${ac}`;
              } else if (key === 'poNo') {
                const rc = buildRawMultiKeywordSql(
                  ['po.po_no'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['so.so_no'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                adjustmentWhere += ` AND 1 = 0`;
              } else if (key === 'partnerName') {
                const rc = buildRawMultiKeywordSql(
                  ['bp.name', 'bp.display_name'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['bp.name', 'bp.display_name'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                adjustmentWhere += ` AND 1 = 0`;
              } else if (key === 'remarks') {
                const rc = buildRawMultiKeywordSql(
                  ['g.remarks'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['g.remarks'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ac = buildRawMultiKeywordSql(
                  ['g.remarks'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                if (ac) adjustmentWhere += ` AND ${ac}`;
              } else if (key === 'date') {
                const rc = buildRawMultiKeywordSql(
                  ["TO_CHAR(g.receipt_date, 'YYYY-MM-DD')"],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ["TO_CHAR(g.issue_date, 'YYYY-MM-DD')"],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ac = buildRawMultiKeywordSql(
                  ["TO_CHAR(g.adjustment_date, 'YYYY-MM-DD')"],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                if (ac) adjustmentWhere += ` AND ${ac}`;
              } else if (key === 'status') {
                const rc = buildRawMultiKeywordSql(
                  ['g.status'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ic = buildRawMultiKeywordSql(
                  ['g.status'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                const ac = buildRawMultiKeywordSql(
                  ['g.status'],
                  searchStr,
                  params,
                  () => pIndex++,
                );
                if (rc) receiptWhere += ` AND ${rc}`;
                if (ic) issueWhere += ` AND ${ic}`;
                if (ac) adjustmentWhere += ` AND ${ac}`;
              }
            }
            continue;
          }

          // 2. Check __BLANK__
          const hasBlank = values.includes('__BLANK__');
          const nonBlank = values.filter((v) => v !== '__BLANK__');

          const applyAnyOrBlank = (fieldSql: string): string => {
            if (hasBlank && nonBlank.length > 0) {
              const idx = pIndex++;
              params.push(nonBlank);
              return `(${fieldSql} = ANY($${idx}) OR ${fieldSql} IS NULL OR ${fieldSql}::text = '')`;
            } else if (hasBlank) {
              return `(${fieldSql} IS NULL OR ${fieldSql}::text = '')`;
            } else {
              const idx = pIndex++;
              params.push(nonBlank);
              return `${fieldSql} = ANY($${idx})`;
            }
          };

          if (key === 'voucherNo') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.receipt_no')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.issue_no')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.adjustment_no')}`;
          } else if (key === 'type') {
            if (!values.includes('receipt')) receiptWhere += ' AND 1 = 0';
            if (!values.includes('issue')) issueWhere += ' AND 1 = 0';
            if (!values.includes('adjustment')) adjustmentWhere += ' AND 1 = 0';
          } else if (key === 'poNo') {
            receiptWhere += ` AND ${applyAnyOrBlank('po.po_no')}`;
            issueWhere += ` AND ${applyAnyOrBlank('so.so_no')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'partnerName') {
            receiptWhere += ` AND ${applyAnyOrBlank('COALESCE(bp.display_name, bp.name)')}`;
            issueWhere += ` AND ${applyAnyOrBlank('COALESCE(bp.display_name, bp.name)')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'category' || key === 'categoryName') {
            receiptWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
            issueWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('cat.name')}`;
          } else if (key === 'remarks') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.remarks')}`;
          } else if (key === 'status') {
            receiptWhere += ` AND ${applyAnyOrBlank('g.status')}`;
            issueWhere += ` AND ${applyAnyOrBlank('g.status')}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('g.status')}`;
          } else if (key === 'date') {
            receiptWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.receipt_date, 'YYYY-MM-DD')")}`;
            issueWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.issue_date, 'YYYY-MM-DD')")}`;
            adjustmentWhere += ` AND ${applyAnyOrBlank("TO_CHAR(g.adjustment_date, 'YYYY-MM-DD')")}`;
          } else if (key === 'qtyReceipt') {
            receiptWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_received), 0) FROM public.erp_goods_receipt_lines rl WHERE rl.goods_receipt_id = g.id)::text')}`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'qtyIssue') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_issued), 0) FROM public.erp_goods_issue_lines il WHERE il.goods_issue_id = g.id)::text')}`;
            adjustmentWhere += ` AND 1 = 0`;
          } else if (key === 'qtyAdjustment') {
            receiptWhere += ` AND 1 = 0`;
            issueWhere += ` AND 1 = 0`;
            adjustmentWhere += ` AND ${applyAnyOrBlank('(SELECT COALESCE(SUM(qty_adjusted), 0) FROM public.erp_inventory_adjustment_lines al WHERE al.adjustment_id = g.id)::text')}`;
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
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT so.so_no as val FROM public.erp_goods_issues g LEFT JOIN public.erp_sales_orders so ON g.sales_order_id = so.id WHERE ${issueWhere}` : ''}
      `;
    } else if (column === 'partnerName') {
      selectExpr = `
        ${includeReceipts ? `SELECT COALESCE(bp.display_name, bp.name) as val FROM public.erp_goods_receipts g LEFT JOIN public.erp_business_partners bp ON g.supplier_id = bp.id WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT COALESCE(bp.display_name, bp.name) as val FROM public.erp_goods_issues g LEFT JOIN public.erp_business_partners bp ON g.customer_id = bp.id WHERE ${issueWhere}` : ''}
      `;
    } else if (column === 'category' || column === 'categoryName') {
      selectExpr = `
        ${includeReceipts ? `SELECT cat.name as val FROM public.erp_goods_receipts g LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id WHERE ${receiptWhere}` : ''}
        ${includeReceipts && includeIssues ? 'UNION ALL' : ''}
        ${includeIssues ? `SELECT cat.name as val FROM public.erp_goods_issues g LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id WHERE ${issueWhere}` : ''}
        ${(includeReceipts || includeIssues) && includeAdjustments ? 'UNION ALL' : ''}
        ${includeAdjustments ? `SELECT cat.name as val FROM public.erp_inventory_adjustments g LEFT JOIN public.erp_bom_categories cat ON g.category_id = cat.id WHERE ${adjustmentWhere}` : ''}
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
      const cond = buildRawMultiKeywordSql(
        ['val::text'],
        search,
        params,
        () => pIndex++,
      );
      if (cond) {
        unionQuery += ` AND ${cond}`;
      }
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
