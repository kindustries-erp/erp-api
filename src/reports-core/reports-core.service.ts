import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { VINFAST_CAR_PART_CODES } from './vinfast-car-part-codes';

@Injectable()
export class ReportsCoreService {
  private readonly vinfastCarPartCodesSql = VINFAST_CAR_PART_CODES.map(
    (code) => `'${code.replace(/'/g, "''")}'`,
  ).join(', ');

  constructor(private readonly dataSource: DataSource) {}

  async getSalesDashboard(query: { dateFrom?: string; dateTo?: string }) {
    const { whereSql, params } = this.buildDateFilter(
      query.dateFrom,
      query.dateTo,
      'so.order_date',
    );

    const kpiSql = `
      WITH line_totals AS (
        SELECT
          sol.sales_order_id,
          SUM(COALESCE(sol.qty_ordered::numeric, 0)) AS total_qty_ordered,
          SUM(COALESCE(sol.qty_delivered::numeric, 0)) AS total_qty_delivered
        FROM erp_sales_order_lines sol
        GROUP BY sol.sales_order_id
      )
      SELECT
        COUNT(so.id)::int AS total_orders,
        COALESCE(SUM(lt.total_qty_ordered), 0)::numeric AS total_qty,
        CASE
          WHEN COALESCE(SUM(lt.total_qty_ordered), 0) = 0 THEN 0
          ELSE ROUND(COALESCE(SUM(lt.total_qty_delivered), 0) * 100.0 / NULLIF(SUM(lt.total_qty_ordered), 0), 2)
        END AS completion_rate
      FROM erp_sales_orders so
      LEFT JOIN line_totals lt ON lt.sales_order_id = so.id
      WHERE so.is_deleted = false ${whereSql}
    `;

    const statusSql = `
      SELECT so.status AS status, COUNT(so.id)::int AS count
      FROM erp_sales_orders so
      WHERE so.is_deleted = false ${whereSql}
      GROUP BY so.status
      ORDER BY count DESC, so.status ASC
    `;

    const trendSql = `
      WITH monthly AS (
        SELECT
          DATE_TRUNC('month', so.order_date::date) AS month,
          SUM(COALESCE(sol.qty_ordered::numeric, 0)) AS qty
        FROM erp_sales_orders so
        LEFT JOIN erp_sales_order_lines sol ON sol.sales_order_id = so.id
        WHERE so.is_deleted = false ${whereSql}
        GROUP BY DATE_TRUNC('month', so.order_date::date)
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') AS month,
        COALESCE(qty, 0)::numeric AS qty
      FROM monthly
      ORDER BY month ASC
    `;

    const topCustomersSql = `
      SELECT
        so.customer_id AS "customerId",
        COALESCE(bp.display_name, bp.name, 'Khách lẻ') AS "customerName",
        COUNT(DISTINCT so.id)::int AS orders,
        COALESCE(SUM(COALESCE(sol.qty_ordered::numeric, 0)), 0)::numeric AS qty
      FROM erp_sales_orders so
      LEFT JOIN erp_sales_order_lines sol ON sol.sales_order_id = so.id
      LEFT JOIN erp_business_partners bp ON bp.id = so.customer_id
      WHERE so.is_deleted = false ${whereSql}
      GROUP BY so.customer_id, bp.display_name, bp.name
      ORDER BY qty DESC, orders DESC
      LIMIT 10
    `;

    const colorBreakdownSql = `
      SELECT
        its.attributes->>'color' AS color,
        COUNT(its.id)::int AS qty,
        string_agg(DISTINCT COALESCE(bp.display_name, bp.name, 'Khách lẻ'), ', ') AS customers
      FROM erp_inventory_tracking_serials its
      JOIN erp_sales_order_lines sol ON sol.id = its.sales_order_line_id
      JOIN erp_sales_orders so ON so.id = sol.sales_order_id
      LEFT JOIN erp_business_partners bp ON bp.id = so.customer_id
      WHERE so.is_deleted = false AND its.attributes->>'color' IS NOT NULL ${whereSql}
      GROUP BY its.attributes->>'color'
      ORDER BY qty DESC
    `;

    const [kpiRows, statusBreakdown, trend, topCustomers, colorBreakdown] =
      await Promise.all([
        this.dataSource.query(kpiSql, params),
        this.dataSource.query(statusSql, params),
        this.dataSource.query(trendSql, params),
        this.dataSource.query(topCustomersSql, params),
        this.dataSource.query(colorBreakdownSql, params),
      ]);

    return {
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      kpi: {
        totalOrders: Number(kpiRows?.[0]?.total_orders || 0),
        totalQty: Number(kpiRows?.[0]?.total_qty || 0),
        completionRate: Number(kpiRows?.[0]?.completion_rate || 0),
      },
      statusBreakdown: (statusBreakdown || []).map((row: any) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),
      trend: (trend || []).map((row: any) => ({
        month: row.month,
        qty: Number(row.qty || 0),
      })),
      topCustomers: (topCustomers || []).map((row: any) => ({
        customerId: row.customerId,
        customerName: row.customerName,
        orders: Number(row.orders || 0),
        qty: Number(row.qty || 0),
      })),
      colorBreakdown: (colorBreakdown || []).map((row: any) => ({
        color: row.color,
        qty: Number(row.qty || 0),
        customers: row.customers,
      })),
    };
  }

  async getPurchasingDashboard(query: { dateFrom?: string; dateTo?: string }) {
    const { whereSql, params } = this.buildDateFilter(
      query.dateFrom,
      query.dateTo,
      'po.order_date',
    );

    const kpiSql = `
      WITH line_totals AS (
        SELECT
          pol.purchase_order_id,
          SUM(COALESCE(pol.qty_ordered::numeric, 0)) AS total_qty_ordered,
          SUM(COALESCE(pol.qty_received::numeric, 0)) AS total_qty_received
        FROM erp_purchase_order_lines pol
        GROUP BY pol.purchase_order_id
      )
      SELECT
        COUNT(po.id)::int AS total_orders,
        COALESCE(SUM(lt.total_qty_ordered), 0)::numeric AS total_qty,
        CASE
          WHEN COALESCE(SUM(lt.total_qty_ordered), 0) = 0 THEN 0
          ELSE ROUND(COALESCE(SUM(lt.total_qty_received), 0) * 100.0 / NULLIF(SUM(lt.total_qty_ordered), 0), 2)
        END AS completion_rate
      FROM erp_purchase_orders po
      LEFT JOIN line_totals lt ON lt.purchase_order_id = po.id
      WHERE po.is_deleted = false ${whereSql}
    `;

    const statusSql = `
      SELECT po.status AS status, COUNT(po.id)::int AS count
      FROM erp_purchase_orders po
      WHERE po.is_deleted = false ${whereSql}
      GROUP BY po.status
      ORDER BY count DESC, po.status ASC
    `;

    const trendSql = `
      WITH monthly AS (
        SELECT
          DATE_TRUNC('month', po.order_date::date) AS month,
          SUM(COALESCE(pol.qty_ordered::numeric, 0)) AS qty
        FROM erp_purchase_orders po
        LEFT JOIN erp_purchase_order_lines pol ON pol.purchase_order_id = po.id
        WHERE po.is_deleted = false ${whereSql}
        GROUP BY DATE_TRUNC('month', po.order_date::date)
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') AS month,
        COALESCE(qty, 0)::numeric AS qty
      FROM monthly
      ORDER BY month ASC
    `;

    const topSuppliersSql = `
      SELECT
        po.supplier_id AS "supplierId",
        COALESCE(bp.display_name, bp.name, 'NCC lẻ') AS "supplierName",
        COUNT(DISTINCT po.id)::int AS orders,
        COALESCE(SUM(COALESCE(pol.qty_ordered::numeric, 0)), 0)::numeric AS qty
      FROM erp_purchase_orders po
      LEFT JOIN erp_purchase_order_lines pol ON pol.purchase_order_id = po.id
      LEFT JOIN erp_business_partners bp ON bp.id = po.supplier_id
      WHERE po.is_deleted = false ${whereSql}
      GROUP BY po.supplier_id, bp.display_name, bp.name
      ORDER BY qty DESC, orders DESC
      LIMIT 10
    `;

    const [kpiRows, statusBreakdown, trend, topSuppliers] = await Promise.all([
      this.dataSource.query(kpiSql, params),
      this.dataSource.query(statusSql, params),
      this.dataSource.query(trendSql, params),
      this.dataSource.query(topSuppliersSql, params),
    ]);

    return {
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      kpi: {
        totalOrders: Number(kpiRows?.[0]?.total_orders || 0),
        totalQty: Number(kpiRows?.[0]?.total_qty || 0),
        completionRate: Number(kpiRows?.[0]?.completion_rate || 0),
      },
      statusBreakdown: (statusBreakdown || []).map((row: any) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),
      trend: (trend || []).map((row: any) => ({
        month: row.month,
        qty: Number(row.qty || 0),
      })),
      topSuppliers: (topSuppliers || []).map((row: any) => ({
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        orders: Number(row.orders || 0),
        qty: Number(row.qty || 0),
      })),
    };
  }

  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
    dateColumn = 'created_at',
  ) {
    const params: string[] = [];
    const predicates: string[] = [];

    if (dateFrom) {
      params.push(dateFrom);
      predicates.push(`${dateColumn}::date >= $${params.length}`);
    }

    if (dateTo) {
      params.push(dateTo);
      predicates.push(`${dateColumn}::date <= $${params.length}`);
    }

    return {
      whereSql: predicates.length > 0 ? ` AND ${predicates.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * Item code precedence for VINFAST IN lines:
   * 1) keyword exceptions, 2) regex-based detection, 3) legacy "code - name" fallback.
   */
  private buildVinfastInItemCodeSql(descriptionExpr: string) {
    const normalizedExpr = `UPPER(COALESCE(${descriptionExpr}, ''))`;
    return `
      CASE
        WHEN ${normalizedExpr} LIKE '%VF5_HV_BATTERY_PACK_38_KWH%' THEN 'EEP73110011AP'
        WHEN ${normalizedExpr} LIKE '%HV_BATTERY_41.9KWH%' THEN 'BAT21001011'
        WHEN ${normalizedExpr} LIKE '%HV_BATTERY_PACK%' THEN 'EEP73110011ALL'
        WHEN SUBSTRING(${normalizedExpr} FROM '([A-Z]{3}[A-Z0-9]+)') IS NOT NULL
          THEN SUBSTRING(${normalizedExpr} FROM '([A-Z]{3}[A-Z0-9]+)')
        WHEN ${descriptionExpr} LIKE '% - %'
          THEN TRIM(SPLIT_PART(${descriptionExpr}, ' - ', 1))
        ELSE NULL
      END
    `;
  }

  private buildVinfastInItemNameSql(descriptionExpr: string) {
    return `
      CASE
        WHEN ${descriptionExpr} LIKE '% - %'
          THEN TRIM(SPLIT_PART(${descriptionExpr}, ' - ', 2))
        ELSE TRIM(COALESCE(${descriptionExpr}, ''))
      END
    `;
  }

  private buildVinfastVehicleTypeSql(itemCodeExpr: string) {
    const normalizedItemCode = `UPPER(TRIM(COALESCE(${itemCodeExpr}, '')))`;
    return `
      CASE
        WHEN ${normalizedItemCode} IN (${this.vinfastCarPartCodesSql}) THEN 'CAR'
        ELSE 'MOTORBIKE'
      END
    `;
  }

  async getVinfastPartsDashboard(query: {
    dateFrom?: string;
    dateTo?: string;
    vehicleType?: string;
    groupBy?: string;
    itemCode?: string;
  }) {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;
    const groupInterval = query.groupBy === 'week' ? 'week' : 'month';
    const groupFormat = query.groupBy === 'week' ? 'YYYY-MM-DD' : 'YYYY-MM';

    if (query.dateFrom) {
      dateFilter += ` AND b.month >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }
    if (query.dateTo) {
      dateFilter += ` AND b.month <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    let vehicleFilter = '';
    if (query.vehicleType && query.vehicleType !== 'all') {
      vehicleFilter = ` AND ${this.buildVinfastVehicleTypeSql('b.item_code')} = $${paramIndex}`;
      params.push(query.vehicleType);
      paramIndex++;
    }

    let itemCodeFilter = '';
    if (query.itemCode) {
      itemCodeFilter = ` AND b.item_code = $${paramIndex}`;
      params.push(query.itemCode);
      paramIndex++;
    }

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');

    const sql = `
      WITH buy_codes AS (
        SELECT 
          ${inItemCodeSql} AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('${groupInterval}', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
      ),
      sell_codes AS (
        SELECT 
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('${groupInterval}', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
      ),
      buy_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount
        FROM sell_codes
        GROUP BY item_code, month
      ),
      base_data AS (
        SELECT 
          b.item_code,
          b.month,
          COALESCE(b.total_amount, 0) AS buy_amount,
          COALESCE(s.total_amount, 0) AS sell_amount
        FROM buy_agg b
        LEFT JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
        WHERE 1=1
          ${dateFilter}
          ${vehicleFilter}
          ${itemCodeFilter}
      )
      SELECT 
        TO_CHAR(month, '${groupFormat}') AS month,
        SUM(buy_amount) AS total_buy,
        SUM(sell_amount) AS total_sell,
        SUM(sell_amount - buy_amount) AS profit
      FROM base_data
      GROUP BY month
      ORDER BY month ASC
    `;

    const rawData = await this.dataSource.query(sql, params);

    const summary = {
      totalBuy: 0,
      totalSell: 0,
      profit: 0,
    };
    const trend = rawData.map((row: any) => {
      const buy = Number(row.total_buy || 0);
      const sell = Number(row.total_sell || 0);
      const profit = Number(row.profit || 0);
      summary.totalBuy += buy;
      summary.totalSell += sell;
      summary.profit += profit;

      return {
        month: row.month,
        totalBuy: buy,
        totalSell: sell,
        profit: profit,
      };
    });

    return {
      summary,
      trend,
    };
  }

  async getVinfastPartsDashboardTable(query: {
    dateFrom?: string;
    dateTo?: string;
    vehicleType?: string;
    page?: number;
    limit?: number;
  }) {
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.dateFrom) {
      dateFilter += ` AND b.month >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }
    if (query.dateTo) {
      dateFilter += ` AND b.month <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql('b.item_code');

    let vehicleTypeFilter = '';
    if (query.vehicleType && query.vehicleType !== 'all') {
      vehicleTypeFilter = ` AND (${vehicleTypeSql}) = $${paramIndex}`;
      params.push(query.vehicleType);
      paramIndex++;
    }

    const sql = `
      WITH buy_codes AS (
        SELECT 
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
      ),
      sell_codes AS (
        SELECT 
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
      ),
      buy_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount
        FROM sell_codes
        GROUP BY item_code, month
      ),
      base_data AS (
        SELECT 
          b.item_code,
          MAX(b.item_name) AS item_name,
          ${vehicleTypeSql} AS vehicle_type,
          SUM(COALESCE(b.total_qty, 0)) AS qty_bought,
          SUM(COALESCE(s.total_qty, 0)) AS qty_sold,
          SUM(COALESCE(b.total_amount, 0)) AS amount_bought,
          SUM(COALESCE(s.total_amount, 0)) AS amount_sold
        FROM buy_agg b
        LEFT JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
        WHERE 1=1
          ${dateFilter}
          ${vehicleTypeFilter}
        GROUP BY b.item_code
      )
      SELECT *, COUNT(*) OVER() AS "totalCount"
      FROM base_data
      ORDER BY amount_sold DESC, amount_bought DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const rawData = await this.dataSource.query(sql, params);
    const total = rawData.length > 0 ? parseInt(rawData[0].totalCount, 10) : 0;
    const totalPages = Math.ceil(total / limit);

    return {
      items: rawData.map((row: any) => ({
        itemCode: row.item_code,
        itemName: row.item_name,
        vehicleType: row.vehicle_type,
        qtyBought: Number(row.qty_bought || 0),
        qtySold: Number(row.qty_sold || 0),
        amountBought: Number(row.amount_bought || 0),
        amountSold: Number(row.amount_sold || 0),
        profit: Number(row.amount_sold || 0) - Number(row.amount_bought || 0),
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getVinfastPartsTracking(query: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    sorts?: string;
    columnSearch?: string;
    columnFilters?: string;
    page?: number;
    limit?: number;
  }) {
    let dateFilter = '';
    let searchFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.dateFrom) {
      dateFilter += ` AND b.month >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      dateFilter += ` AND b.month <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    if (query.search) {
      searchFilter = `AND b.item_code ILIKE $${paramIndex}`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    const sortMap: Record<string, string> = {
      itemCode: '"itemCode"',
      month: '"month"',
      itemName: '"itemName"',
      vehicleType: '"vehicleType"',
      qtyBought: '"qtyBought"',
      qtySold: '"qtySold"',
      avgBuyPrice: '"avgBuyPrice"',
      avgSellPrice: '"avgSellPrice"',
      margin: '("avgSellPrice" - "avgBuyPrice")',
      marginPct:
        '(TO_CHAR(CASE WHEN "avgBuyPrice" > 0 THEN (("avgSellPrice" - "avgBuyPrice") / "avgBuyPrice" * 100.0) ELSE 0.0 END, \'FM999999990.0\') || \'%\')',
    };

    let orderByClause = 'ORDER BY "month" DESC, "itemCode" ASC';

    if (query.sorts) {
      try {
        const parsedSorts: string[] = JSON.parse(query.sorts);
        const orderParts: string[] = [];
        for (const sortItem of parsedSorts) {
          const isDesc = sortItem.startsWith('-');
          const field = isDesc ? sortItem.substring(1) : sortItem;
          const dir = isDesc ? 'DESC' : 'ASC';

          if (sortMap[field]) {
            if (field === 'marginPct') {
              orderParts.push(
                `(CASE WHEN "avgBuyPrice" > 0 THEN (("avgSellPrice" - "avgBuyPrice") / "avgBuyPrice" * 100.0) ELSE 0.0 END) ${dir}`,
              );
            } else {
              orderParts.push(`${sortMap[field]} ${dir}`);
            }
          }
        }
        if (orderParts.length > 0) {
          orderByClause = `ORDER BY ${orderParts.join(', ')}`;
        }
      } catch (e) {}
    } else if (query.sortBy && sortMap[query.sortBy]) {
      const dir = query.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      if (query.sortBy === 'marginPct') {
        orderByClause = `ORDER BY (CASE WHEN "avgBuyPrice" > 0 THEN (("avgSellPrice" - "avgBuyPrice") / "avgBuyPrice" * 100.0) ELSE 0.0 END) ${dir}`;
      } else {
        orderByClause = `ORDER BY ${sortMap[query.sortBy]} ${dir}`;
      }
    }

    let columnSearchFilter = '';
    if (query.columnSearch) {
      try {
        const cs = JSON.parse(query.columnSearch);
        for (const [key, val] of Object.entries(cs)) {
          if (val && typeof val === 'string' && sortMap[key]) {
            columnSearchFilter += ` AND ${sortMap[key]}::text ILIKE $${paramIndex}`;
            params.push(`%${val}%`);
            paramIndex++;
          }
        }
      } catch (e) {}
    }

    let columnFiltersFilter = '';
    if (query.columnFilters) {
      try {
        const cf = JSON.parse(query.columnFilters);
        for (const [key, vals] of Object.entries(cf)) {
          if (Array.isArray(vals) && vals.length > 0 && sortMap[key]) {
            if (vals[0] === '__ALL_MATCHING__') {
              const searchStr = vals[1] || '';
              if (searchStr) {
                columnFiltersFilter += ` AND ${sortMap[key]}::text ILIKE $${paramIndex}`;
                params.push(`%${searchStr}%`);
                paramIndex++;
              }
            } else {
              const placeholders = vals
                .map(() => {
                  const ph = `$${paramIndex}`;
                  paramIndex++;
                  return ph;
                })
                .join(', ');
              columnFiltersFilter += ` AND ${sortMap[key]}::text IN (${placeholders})`;
              params.push(...vals);
            }
          }
        }
      } catch (e) {}
    }

    const limit = query.limit || 50;
    const page = query.page || 1;
    const offset = (page - 1) * limit;
    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql('b.item_code');

    const sql = `
      WITH buy_codes AS (
        SELECT 
          ii.invoice_id,
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
      ),
      sell_codes AS (
        SELECT 
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
      ),
      buy_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          ROUND(AVG(unit_price)) AS avg_price,
          ARRAY_AGG(DISTINCT invoice_id) AS invoice_ids
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          ROUND(AVG(unit_price)) AS avg_price,
          ARRAY_AGG(DISTINCT invoice_id) AS invoice_ids
        FROM sell_codes
        GROUP BY item_code, month
      ),
      base_data AS (
        SELECT 
          b.item_code AS "itemCode",
          b.item_name AS "itemName",
          ${vehicleTypeSql} AS "vehicleType",
          TO_CHAR(b.month, 'YYYY-MM') AS "month",
          COALESCE(b.total_qty, 0) AS "qtyBought",
          COALESCE(s.total_qty, 0) AS "qtySold",
          COALESCE(b.avg_price, 0) AS "avgBuyPrice",
          COALESCE(s.avg_price, 0) AS "avgSellPrice",
          b.invoice_ids AS "buyInvoiceIds",
          s.invoice_ids AS "sellInvoiceIds"
        FROM buy_agg b
        LEFT JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
        WHERE 1=1
          ${dateFilter}
          ${searchFilter}
      ),
      filtered_data AS (
        SELECT *, COUNT(*) OVER() AS "totalCount"
        FROM base_data
        WHERE 1=1
          ${columnSearchFilter}
          ${columnFiltersFilter}
      )
      SELECT *
      FROM filtered_data
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const rawData = await this.dataSource.query(sql, params);

    const total = rawData.length > 0 ? parseInt(rawData[0].totalCount, 10) : 0;

    const data = rawData.map((row: any) => {
      const qtyBought = parseFloat(row.qtyBought || '0');
      const qtySold = parseFloat(row.qtySold || '0');
      const avgBuyPrice = parseFloat(row.avgBuyPrice || '0');
      const avgSellPrice = parseFloat(row.avgSellPrice || '0');
      const hasSoldQty = qtySold > 0;
      const margin = hasSoldQty ? avgSellPrice - avgBuyPrice : null;
      const marginPct =
        hasSoldQty && avgBuyPrice > 0 ? (margin! / avgBuyPrice) * 100 : null;

      return {
        itemCode: row.itemCode,
        itemName: row.itemName,
        vehicleType: row.vehicleType,
        month: row.month,
        buyInvoiceIds: row.buyInvoiceIds,
        sellInvoiceIds: row.sellInvoiceIds,
        qtyBought,
        qtySold,
        avgBuyPrice,
        avgSellPrice,
        margin,
        marginPct: marginPct == null ? '' : marginPct.toFixed(1) + '%',
      };
    });

    return { data, total };
  }

  async getVinfastPartsTrackingDetails(query: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    itemCode?: string;
  }) {
    let dateFilter = '';
    let searchFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (query.dateFrom) {
      dateFilter += ` AND c.month >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      dateFilter += ` AND c.month <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    if (query.search) {
      searchFilter = `AND c.item_code ILIKE $${paramIndex}`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    if (query.itemCode) {
      searchFilter += ` AND c.item_code = $${paramIndex}`;
      params.push(query.itemCode);
      paramIndex++;
    }

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql('c.item_code');

    const sql = `
      WITH buy_codes AS (
        SELECT 
          'IN' as direction,
          MAX(i.invoice_no) AS invoice_no,
          MAX(i.serial_no) AS serial_no,
          MAX(i.status) AS status,
          MAX(i.seller_name) AS partner_name,
          MAX(i.seller_tax_code) AS tax_code,
          MAX(TO_CHAR(i.invoice_date, 'YYYY-MM-DD')) as invoice_date,
          ii.invoice_id,
          ${inItemCodeSql} AS item_code,
          MAX(${inItemNameSql}) AS item_name,
          MAX(ii.unit) AS unit,
          COALESCE(SUM(ii.quantity::numeric), 0) AS qty,
          AVG(ii.unit_price::numeric) AS unit_price,
          SUM(ii.quantity::numeric * ii.unit_price::numeric) AS pre_vat_amount,
          MAX(COALESCE(ii.vat_rate, i.vat_rate)) AS vat_rate,
          SUM(
            COALESCE(
              NULLIF(ii.vat_amount::numeric, 0), 
              CASE 
                WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
                THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * COALESCE(ii.vat_rate, i.vat_rate)::numeric)
                ELSE 0 
              END, 
              0
            )
          ) AS vat_amount,
          SUM(
            (ii.quantity::numeric * ii.unit_price::numeric) + COALESCE(
              NULLIF(ii.vat_amount::numeric, 0), 
              CASE 
                WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
                THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * COALESCE(ii.vat_rate, i.vat_rate)::numeric)
                ELSE 0 
              END, 
              0
            )
          ) AS total_amount,
          MAX(DATE_TRUNC('month', i.invoice_date::date)) AS month,
          MAX(i.license_plate) AS license_plate,
          MAX(i.settlement_order) AS settlement_order,
          MAX(ii.description) AS description
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
        GROUP BY ii.invoice_id, ${inItemCodeSql}
      ),
      sell_codes AS (
        SELECT 
          'OUT' as direction,
          MAX(i.invoice_no) AS invoice_no,
          MAX(i.serial_no) AS serial_no,
          MAX(i.status) AS status,
          MAX(i.buyer_name) AS partner_name,
          MAX(i.buyer_tax_code) AS tax_code,
          MAX(TO_CHAR(i.invoice_date, 'YYYY-MM-DD')) as invoice_date,
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          '' AS item_name,
          MAX(ii.unit) AS unit,
          COALESCE(SUM(ii.quantity::numeric), 0) AS qty,
          AVG(ii.unit_price::numeric) AS unit_price,
          SUM(ii.quantity::numeric * ii.unit_price::numeric) AS pre_vat_amount,
          MAX(COALESCE(ii.vat_rate, i.vat_rate)) AS vat_rate,
          SUM(
            COALESCE(
              NULLIF(ii.vat_amount::numeric, 0), 
              CASE 
                WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
                THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * COALESCE(ii.vat_rate, i.vat_rate)::numeric)
                ELSE 0 
              END, 
              0
            )
          ) AS vat_amount,
          SUM(
            (ii.quantity::numeric * ii.unit_price::numeric) + COALESCE(
              NULLIF(ii.vat_amount::numeric, 0), 
              CASE 
                WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
                THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * COALESCE(ii.vat_rate, i.vat_rate)::numeric)
                ELSE 0 
              END, 
              0
            )
          ) AS total_amount,
          MAX(DATE_TRUNC('month', i.invoice_date::date)) AS month,
          MAX(i.license_plate) AS license_plate,
          MAX(i.settlement_order) AS settlement_order,
          MAX(ii.description) AS description
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
        GROUP BY ii.invoice_id, TRIM(SPLIT_PART(ii.description, ' ', 1))
      )
      SELECT 
        c.direction,
        c.invoice_no AS "invoiceNo",
        c.serial_no AS "serialNo",
        c.status,
        c.partner_name AS "partnerName",
        c.tax_code AS "taxCode",
        c.invoice_date AS "invoiceDate",
        c.invoice_id AS "invoiceId",
        c.item_code AS "itemCode",
        b.item_name AS "itemName",
        ${vehicleTypeSql} AS "vehicleType",
        c.unit,
        c.qty,
        c.unit_price AS "unitPrice",
        c.pre_vat_amount AS "preVatAmount",
        c.vat_rate AS "vatRate",
        c.vat_amount AS "vatAmount",
        c.total_amount AS "totalAmount",
        c.license_plate AS "licensePlate",
        c.settlement_order AS "settlementOrder",
        c.description,
        TO_CHAR(c.month, 'YYYY-MM') AS "month"
      FROM (
        SELECT * FROM buy_codes
        UNION ALL
        SELECT * FROM sell_codes
      ) c
      LEFT JOIN (
        SELECT DISTINCT item_code, item_name, month FROM buy_codes
      ) b ON b.item_code = c.item_code AND b.month = c.month
      WHERE 1=1
        AND EXISTS (SELECT 1 FROM buy_codes b2 WHERE b2.item_code = c.item_code AND b2.month = c.month)
        ${dateFilter}
        ${searchFilter}
      ORDER BY c.month DESC, c.item_code ASC, c.direction ASC, c.invoice_date ASC
    `;

    return await this.dataSource.query(sql, params);
  }

  async exportVinfastPartsTrackingExcel(query: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sorts?: string;
    columnSearch?: string;
    columnFilters?: string;
  }) {
    // 1. Fetch overview data
    const overviewDataResp = await this.getVinfastPartsTracking({
      ...query,
      page: 1,
      limit: 1000000,
    });
    const overviewData = overviewDataResp.data;
    const overviewItemCodes = new Set(overviewData.map((d: any) => d.itemCode));

    // 2. Fetch details data and filter by overview items
    let rawData = await this.getVinfastPartsTrackingDetails({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    });
    rawData = rawData.filter((row: any) => overviewItemCodes.has(row.itemCode));

    const workbook = new ExcelJS.Workbook();

    const overviewColumns = [
      { header: 'Tháng', key: 'month', width: 12 },
      { header: 'Mã phụ tùng', key: 'itemCode', width: 20 },
      { header: 'Tên phụ tùng', key: 'itemName', width: 40 },
      { header: 'Loại xe', key: 'vehicleType', width: 14 },
      { header: 'SL mua (VINFAST)', key: 'qtyBought', width: 15 },
      { header: 'Giá mua TB', key: 'avgBuyPrice', width: 15 },
      { header: 'SL bán ra', key: 'qtySold', width: 15 },
      { header: 'Giá bán TB', key: 'avgSellPrice', width: 15 },
      { header: 'Biên LN', key: 'margin', width: 15 },
      { header: 'Biên LN (%)', key: 'marginPct', width: 15 },
    ];

    const detailColumns = [
      { header: 'Tháng', key: 'month', width: 12 },
      { header: 'Mã phụ tùng', key: 'itemCode', width: 15 },
      { header: 'Tên phụ tùng', key: 'itemName', width: 40 },
      { header: 'Loại xe', key: 'vehicleType', width: 14 },
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Diễn giải', key: 'description', width: 40 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Số lượng', key: 'qty', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 20 },
      { header: 'Trước thuế GTGT', key: 'preVatAmount', width: 20 },
      {
        header: 'Thuế suất',
        key: 'vatRate',
        width: 15,
        style: { numFmt: '0%' },
      },
      { header: 'Thuế GTGT', key: 'vatAmount', width: 20 },
      { header: 'Thành tiền', key: 'totalAmount', width: 20 },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh quyết toán', key: 'settlementOrder', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 15 },
    ];

    const setupSheetHeader = (
      sheet: ExcelJS.Worksheet,
      filterColumnCount: number,
    ) => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).alignment = { horizontal: 'center' };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      sheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' },
      ];
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: filterColumnCount },
      };
    };

    const createOverviewSheet = (sheetName: string, rows: any[]) => {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = overviewColumns as any;
      setupSheetHeader(sheet, 10);

      rows.forEach((row: any) => {
        sheet.addRow({
          month: row.month,
          itemCode: row.itemCode,
          itemName: row.itemName,
          vehicleType: row.vehicleType,
          qtyBought: row.qtyBought,
          avgBuyPrice: row.avgBuyPrice,
          qtySold: row.qtySold,
          avgSellPrice: row.avgSellPrice,
          margin: row.margin,
          marginPct: row.marginPct,
        });
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          [
            'qtyBought',
            'avgBuyPrice',
            'qtySold',
            'avgSellPrice',
            'margin',
          ].forEach((key) => {
            const cell = row.getCell(key);
            cell.numFmt = '#,##0';
          });
        }
      });
    };

    const createDetailSheet = (sheetName: string, rows: any[]) => {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.columns = detailColumns as any;
      setupSheetHeader(sheet, 20);

      rows.forEach((row: any) => {
        sheet.addRow({
          month: row.month,
          itemCode: row.itemCode,
          itemName: row.itemName,
          vehicleType: row.vehicleType,
          invoiceDate: row.invoiceDate,
          serialNo: row.serialNo,
          invoiceNo: row.invoiceNo,
          partnerName: row.partnerName,
          taxCode: row.taxCode,
          description: row.description,
          unit: row.unit,
          qty: parseFloat(row.qty || '0'),
          unitPrice: parseFloat(row.unitPrice || '0'),
          preVatAmount: parseFloat(row.preVatAmount || '0'),
          vatRate: parseVat(row.vatRate),
          vatAmount: parseFloat(row.vatAmount || '0'),
          totalAmount: parseFloat(row.totalAmount || '0'),
          licensePlate: row.licensePlate,
          settlementOrder: row.settlementOrder,
          status: row.status,
        });
      });

      const numColumns = [
        'qty',
        'unitPrice',
        'preVatAmount',
        'vatAmount',
        'totalAmount',
      ];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          numColumns.forEach((key) => {
            const cell = row.getCell(key);
            cell.numFmt = '#,##0';
          });
        }
      });
    };

    const parseVat = (val: any) => {
      if (!val) return '';
      const n = parseFloat(val);
      return isNaN(n) ? val : n;
    };

    const parsedFilters = query.columnFilters
      ? JSON.parse(query.columnFilters)
      : {};
    const reqVehicleType = parsedFilters['vehicleType'];

    const vehicleTypeSheetPrefix: Record<string, string> = {};
    if (
      reqVehicleType &&
      reqVehicleType.includes('CAR') &&
      !reqVehicleType.includes('MOTORBIKE')
    ) {
      vehicleTypeSheetPrefix['CAR'] = 'Ô tô';
    } else if (
      reqVehicleType &&
      reqVehicleType.includes('MOTORBIKE') &&
      !reqVehicleType.includes('CAR')
    ) {
      vehicleTypeSheetPrefix['MOTORBIKE'] = 'Xe máy';
    } else {
      vehicleTypeSheetPrefix['CAR'] = 'Ô tô';
      vehicleTypeSheetPrefix['MOTORBIKE'] = 'Xe máy';
    }

    Object.entries(vehicleTypeSheetPrefix).forEach(([vehicleType, prefix]) => {
      const typeOverviewRows = overviewData.filter(
        (row: any) => row.vehicleType === vehicleType,
      );
      const typeDetailRows = rawData.filter(
        (row: any) => row.vehicleType === vehicleType,
      );

      createOverviewSheet(`${prefix} - Tổng quan`, typeOverviewRows);
      createDetailSheet(
        `${prefix} - Mua Vào`,
        typeDetailRows.filter((row: any) => row.direction === 'IN'),
      );
      createDetailSheet(
        `${prefix} - Bán Ra`,
        typeDetailRows.filter((row: any) => row.direction === 'OUT'),
      );
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any;
  }

  async getVinfastPartsColumnOptions(query: {
    columnKey: string;
    search: string;
    page: number;
    limit: number;
    filtersStr: string;
  }) {
    // Re-use the CTEs to get the base data, then fetch distinct values for the requested column
    const mapColumn: Record<string, string> = {
      itemCode: '"itemCode"',
      month: '"month"',
      itemName: '"itemName"',
      vehicleType: '"vehicleType"',
      qtyBought: '"qtyBought"',
      qtySold: '"qtySold"',
      avgBuyPrice: '"avgBuyPrice"',
      avgSellPrice: '"avgSellPrice"',
      margin: '("avgSellPrice" - "avgBuyPrice")',
      marginPct:
        '(TO_CHAR(CASE WHEN "avgBuyPrice" > 0 THEN (("avgSellPrice" - "avgBuyPrice") / "avgBuyPrice" * 100.0) ELSE 0.0 END, \'FM999999990.0\') || \'%\')',
    };

    const sqlCol = mapColumn[query.columnKey];
    if (!sqlCol) {
      return { items: [], total: 0, page: query.page, totalPages: 0 };
    }

    const params: any[] = [];
    let paramIndex = 1;
    let otherFiltersSql = '';

    try {
      const filters = JSON.parse(query.filtersStr || '{}');
      for (const [key, vals] of Object.entries(filters)) {
        if (key === query.columnKey) continue;
        if (Array.isArray(vals) && vals.length > 0 && mapColumn[key]) {
          const placeholders = vals
            .map(() => {
              const ph = `$${paramIndex++}`;
              return ph;
            })
            .join(', ');
          otherFiltersSql += ` AND ${mapColumn[key]}::text IN (${placeholders})`;
          params.push(...vals);
        }
      }
    } catch (e) {}

    if (query.search) {
      otherFiltersSql += ` AND ${sqlCol}::text ILIKE $${paramIndex++}`;
      params.push(`%${query.search}%`);
    }

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql('b.item_code');

    const sql = `
      WITH buy_codes AS (
        SELECT 
          ii.invoice_id,
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
      ),
      sell_codes AS (
        SELECT 
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
      ),
      base_data AS (
        SELECT 
          b.item_code AS "itemCode",
          b.item_name AS "itemName",
          ${vehicleTypeSql} AS "vehicleType",
          TO_CHAR(b.month, 'YYYY-MM') AS "month",
          COALESCE(SUM(b.qty), 0) AS "qtyBought",
          COALESCE(SUM(s.qty), 0) AS "qtySold",
          COALESCE(ROUND(AVG(b.unit_price)), 0) AS "avgBuyPrice",
          COALESCE(ROUND(AVG(s.unit_price)), 0) AS "avgSellPrice"
        FROM buy_codes b
        LEFT JOIN sell_codes s ON s.item_code = b.item_code AND s.month = b.month
        GROUP BY b.item_code, b.item_name, b.month
      ),
      filtered_data AS (
        SELECT DISTINCT ${sqlCol}::text AS value
        FROM base_data
        WHERE 1=1 ${otherFiltersSql}
        AND ${sqlCol} IS NOT NULL
      )
      SELECT value, COUNT(*) OVER() AS total_count
      FROM filtered_data
      ORDER BY value ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const limit = query.limit || 20;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    params.push(limit, offset);

    const rows = await this.dataSource.query(sql, params);
    const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    const items = rows.map((r: any) => ({
      value: r.value,
      label: r.value,
    }));

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
