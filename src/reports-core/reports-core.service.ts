import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Subject } from 'rxjs';
import { VINFAST_CAR_PART_CODES } from './vinfast-car-part-codes';
import {
  VinfastPartsExportBackgroundService,
  type VinfastPartsExportHistoryResult,
  type VinfastPartsExportProgressEvent,
  type VinfastPartsExportQuery,
} from './services/vinfast-parts-export-background.service';

@Injectable()
export class ReportsCoreService {
  private readonly vinfastSellerTaxCodes = [
    '0108926276',
    '0318334886',
    '0202357718',
  ];
  private readonly vinfastSellerTaxCodesSql = this.vinfastSellerTaxCodes
    .map((taxCode) => `'${taxCode.replace(/'/g, "''")}'`)
    .join(', ');

  private readonly vinfastCarPartCodesSql = VINFAST_CAR_PART_CODES.map(
    (code) => `'${code.replace(/'/g, "''")}'`,
  ).join(', ');

  constructor(
    private readonly dataSource: DataSource,
    private readonly vinfastPartsExportBackgroundService: VinfastPartsExportBackgroundService,
  ) {}

  get vinfastPartsExportProgress$(): Subject<VinfastPartsExportProgressEvent> {
    return this.vinfastPartsExportBackgroundService.progress$;
  }

  startVinfastPartsExportBackground(
    query: VinfastPartsExportQuery,
    userId: string,
  ) {
    return this.vinfastPartsExportBackgroundService.startBackgroundExport(
      query,
      userId,
      async (onProgress) =>
        this.exportVinfastPartsTrackingExcel(query, { onProgress }),
    );
  }

  getVinfastPartsExportHistory(
    userId: string,
    page?: number,
    pageSize?: number,
  ): VinfastPartsExportHistoryResult {
    return this.vinfastPartsExportBackgroundService.listHistoryForUser(
      userId,
      page,
      pageSize,
    );
  }

  getVinfastPartsExportProgressSnapshot(userId: string) {
    return this.vinfastPartsExportBackgroundService.getJobSnapshotForUser(
      userId,
    );
  }

  getVinfastPartsExportBackgroundFile(jobId: string, userId: string) {
    return this.vinfastPartsExportBackgroundService.getReadyExportFile(
      jobId,
      userId,
    );
  }

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
   * 1) keyword exceptions, 2) strict regex-based detection.
   */
  private buildPurchasedItemCodesCteSql(inItemCodeSql: string) {
    return `
      purchased_item_codes AS (
        SELECT 
          (${inItemCodeSql}) AS item_code,
          BOOL_OR(i.seller_tax_code = '0318334886') AS from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
        GROUP BY (${inItemCodeSql})
      ),`;
  }

  private buildVinfastInItemCodeSql(descriptionExpr: string) {
    const normalizedExpr = `UPPER(COALESCE(${descriptionExpr}, ''))`;
    const canonicalExpr = `REGEXP_REPLACE(${normalizedExpr}, '[^A-Z0-9]+', '_', 'g')`;
    return `
      CASE
        WHEN ${normalizedExpr} LIKE '%VF5_HV_BATTERY_PACK_38_KWH%'
          OR ${canonicalExpr} LIKE '%VF5_HV_BATTERY_PACK_38_KWH%'
          THEN 'EEP73110011AP'
        WHEN ${normalizedExpr} LIKE '%HV_BATTERY_41.9KWH%'
          OR ${canonicalExpr} LIKE '%HV_BATTERY_41_9KWH%'
          OR ${canonicalExpr} LIKE '%HV_BATTERY_41_9_KWH%'
          OR ${canonicalExpr} LIKE '%BAT21001011%'
          THEN 'BAT21001011'
        WHEN ${normalizedExpr} LIKE '%HV_BATTERY_PACK%'
          OR ${canonicalExpr} LIKE '%HV_BATTERY_PACK%'
          THEN 'EEP73110011ALL'
        WHEN SUBSTRING(${normalizedExpr} FROM '([A-Z]{3}[0-9][A-Z0-9]*)') IS NOT NULL
          THEN SUBSTRING(${normalizedExpr} FROM '([A-Z]{3}[0-9][A-Z0-9]*)')
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

  private buildVinfastVehicleTypeSql(
    itemCodeExpr: string,
    carSellerBoolExpr?: string,
  ) {
    const normalizedItemCode = `UPPER(TRIM(COALESCE(${itemCodeExpr}, '')))`;
    const carSellerWhen = carSellerBoolExpr
      ? `WHEN ${carSellerBoolExpr} THEN 'CAR'`
      : '';
    return `
      CASE
        ${carSellerWhen}
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
      dateFilter += ` AND c.month >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }
    if (query.dateTo) {
      dateFilter += ` AND c.month <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    let vehicleFilter = '';
    if (query.vehicleType && query.vehicleType !== 'all') {
      vehicleFilter = ` AND ${this.buildVinfastVehicleTypeSql('c.item_code', 'c.from_car_seller')} = $${paramIndex}`;
      params.push(query.vehicleType);
      paramIndex++;
    }

    let itemCodeFilter = '';
    if (query.itemCode) {
      itemCodeFilter = ` AND c.item_code = $${paramIndex}`;
      params.push(query.itemCode);
      paramIndex++;
    }

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
        SELECT 
          ${inItemCodeSql} AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('${groupInterval}', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      sell_codes AS (
        SELECT 
          (${inItemCodeSql}) AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('${groupInterval}', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      buy_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM sell_codes
        GROUP BY item_code, month
      ),
      combined_data AS (
        SELECT
          COALESCE(b.item_code, s.item_code) AS item_code,
          COALESCE(b.month, s.month) AS month,
          COALESCE(b.total_amount, 0) AS buy_amount,
          COALESCE(s.total_amount, 0) AS sell_amount,
          COALESCE(b.from_car_seller, s.from_car_seller, false) AS from_car_seller
        FROM buy_agg b
        FULL OUTER JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
      ),
      base_data AS (
        SELECT 
          c.item_code,
          c.month,
          c.buy_amount,
          c.sell_amount
        FROM combined_data c
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
    columnSearch?: string;
    columnFilters?: string;
    sorts?: string;
  }) {
    let dateFilter = '';
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

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    // Used in WHERE (row-level, before GROUP BY)
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql(
      'c.item_code',
      'c.from_car_seller',
    );
    // Used in SELECT (after GROUP BY — from_car_seller must be aggregated)
    const vehicleTypeSelectSql = this.buildVinfastVehicleTypeSql(
      'c.item_code',
      'BOOL_OR(c.from_car_seller)',
    );

    let vehicleTypeFilter = '';
    if (query.vehicleType && query.vehicleType !== 'all') {
      vehicleTypeFilter = ` AND (${vehicleTypeSql}) = $${paramIndex}`;
      params.push(query.vehicleType);
      paramIndex++;
    }

    const numericColMap: Record<string, string> = {
      qtyBought: 'qty_bought',
      qtySold: 'qty_sold',
      amountBought: 'amount_bought',
      amountSold: 'amount_sold',
      profit: '(amount_sold - amount_bought)',
    };

    let searchFilter = '';
    let numericSearchFilter = '';
    if (query.columnSearch) {
      try {
        const cSearch = JSON.parse(query.columnSearch) as Record<
          string,
          string
        >;
        for (const [col, val] of Object.entries(cSearch)) {
          if (!val) continue;
          if (col === 'itemCode') {
            searchFilter += ` AND c.item_code ILIKE $${paramIndex}`;
            params.push(`%${val}%`);
            paramIndex++;
          } else if (col === 'itemName') {
            searchFilter += ` AND c.item_name ILIKE $${paramIndex}`;
            params.push(`%${val}%`);
            paramIndex++;
          } else if (numericColMap[col]) {
            numericSearchFilter += ` AND ${numericColMap[col]}::text ILIKE $${paramIndex}`;
            params.push(`%${val}%`);
            paramIndex++;
          }
        }
      } catch (e) {}
    }

    let filtersSql = '';
    let numericFiltersSql = '';
    if (query.columnFilters) {
      try {
        const cFilters = JSON.parse(query.columnFilters) as Record<
          string,
          string[]
        >;
        for (const [col, vals] of Object.entries(cFilters)) {
          if (!vals || vals.length === 0) continue;
          if (col === 'itemCode') {
            filtersSql += ` AND c.item_code = ANY($${paramIndex})`;
            params.push(vals);
            paramIndex++;
          } else if (col === 'itemName') {
            filtersSql += ` AND c.item_name = ANY($${paramIndex})`;
            params.push(vals);
            paramIndex++;
          } else if (numericColMap[col]) {
            numericFiltersSql += ` AND ${numericColMap[col]}::text = ANY($${paramIndex})`;
            params.push(vals);
            paramIndex++;
          }
        }
      } catch (e) {}
    }

    let orderSql = 'ORDER BY amount_sold DESC, amount_bought DESC';
    if (query.sorts) {
      try {
        const sortsArr = JSON.parse(query.sorts) as string[];
        if (sortsArr.length > 0) {
          const sortFields: string[] = [];
          for (const s of sortsArr) {
            const isDesc = s.startsWith('-');
            const col = s.replace(/^-/, '');
            let sqlCol = '';
            if (col === 'itemCode') sqlCol = 'item_code';
            else if (col === 'itemName') sqlCol = 'item_name';
            else if (col === 'qtyBought') sqlCol = 'qty_bought';
            else if (col === 'qtySold') sqlCol = 'qty_sold';
            else if (col === 'amountBought') sqlCol = 'amount_bought';
            else if (col === 'amountSold') sqlCol = 'amount_sold';
            else if (col === 'profit') sqlCol = '(amount_sold - amount_bought)';

            if (sqlCol) {
              sortFields.push(`${sqlCol} ${isDesc ? 'DESC' : 'ASC'}`);
            }
          }
          if (sortFields.length > 0) {
            orderSql = `ORDER BY ${sortFields.join(', ')}`;
          }
        }
      } catch (e) {}
    }

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
        SELECT 
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      sell_codes AS (
        SELECT 
          (${inItemCodeSql}) AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      buy_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM sell_codes
        GROUP BY item_code, month
      ),
      combined_data AS (
        SELECT
          COALESCE(b.item_code, s.item_code) AS item_code,
          COALESCE(b.item_name, '') AS item_name,
          COALESCE(b.month, s.month) AS month,
          COALESCE(b.total_qty, 0) AS qty_bought,
          COALESCE(s.total_qty, 0) AS qty_sold,
          COALESCE(b.total_amount, 0) AS amount_bought,
          COALESCE(s.total_amount, 0) AS amount_sold,
          COALESCE(b.from_car_seller, s.from_car_seller, false) AS from_car_seller
        FROM buy_agg b
        FULL OUTER JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
      ),
      base_data AS (
        SELECT 
          c.item_code,
          MAX(c.item_name) AS item_name,
          ${vehicleTypeSelectSql} AS vehicle_type,
          SUM(c.qty_bought) AS qty_bought,
          SUM(c.qty_sold) AS qty_sold,
          SUM(c.amount_bought) AS amount_bought,
          SUM(c.amount_sold) AS amount_sold
        FROM combined_data c
        WHERE 1=1
          ${dateFilter}
          ${vehicleTypeFilter}
          ${searchFilter}
          ${filtersSql}
        GROUP BY c.item_code
      ),
      filtered_data AS (
        SELECT *, COUNT(*) OVER() AS "totalCount"
        FROM base_data
        WHERE 1=1 ${numericSearchFilter} ${numericFiltersSql}
      )
      SELECT *
      FROM filtered_data
      ${orderSql}
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
      dateFilter += ` AND COALESCE(b.month, s.month) >= $${paramIndex}`;
      params.push(query.dateFrom);
      paramIndex++;
    }

    if (query.dateTo) {
      dateFilter += ` AND COALESCE(b.month, s.month) <= $${paramIndex}`;
      params.push(query.dateTo);
      paramIndex++;
    }

    if (query.search) {
      searchFilter = `AND COALESCE(b.item_code, s.item_code) ILIKE $${paramIndex}`;
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
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql(
      'COALESCE(b.item_code, s.item_code)',
      'COALESCE(b.from_car_seller, false)',
    );

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
        SELECT 
          ii.invoice_id,
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      sell_codes AS (
        SELECT 
          ii.invoice_id,
          (${inItemCodeSql}) AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      buy_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          ROUND(AVG(unit_price)) AS avg_price,
          ARRAY_AGG(DISTINCT invoice_id) AS invoice_ids,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          ROUND(AVG(unit_price)) AS avg_price,
          ARRAY_AGG(DISTINCT invoice_id) AS invoice_ids
        FROM sell_codes
        GROUP BY item_code, month
      ),
      base_data AS (
        SELECT 
          COALESCE(b.item_code, s.item_code) AS "itemCode",
          COALESCE(b.item_name, s.item_name) AS "itemName",
          ${vehicleTypeSql} AS "vehicleType",
          TO_CHAR(COALESCE(b.month, s.month), 'YYYY-MM') AS "month",
          COALESCE(b.total_qty, 0) AS "qtyBought",
          COALESCE(s.total_qty, 0) AS "qtySold",
          COALESCE(b.avg_price, 0) AS "avgBuyPrice",
          COALESCE(s.avg_price, 0) AS "avgSellPrice",
          b.invoice_ids AS "buyInvoiceIds",
          s.invoice_ids AS "sellInvoiceIds"
        FROM buy_agg b
        FULL OUTER JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
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
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql(
      'c.item_code',
      'c.from_car_seller',
    );

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
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
          MAX(ii.description) AS description,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
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
          (${inItemCodeSql}) AS item_code,
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
          MAX(ii.description) AS description,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
        GROUP BY ii.invoice_id, (${inItemCodeSql})
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
        c.item_name AS "itemName",
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
      WHERE 1=1
        ${dateFilter}
        ${searchFilter}
      ORDER BY c.month DESC, c.item_code ASC, c.direction ASC, c.invoice_date ASC
    `;

    return await this.dataSource.query(sql, params);
  }

  async exportVinfastPartsTrackingExcel(
    query: {
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      sortBy?: string;
      sortDir?: 'asc' | 'desc';
      sorts?: string;
      columnSearch?: string;
      columnFilters?: string;
    },
    options?: {
      onProgress?: (current: number, total: number, message: string) => void;
    },
  ) {
    const onProgress = options?.onProgress;
    const totalProgressUnits = 100;

    onProgress?.(5, totalProgressUnits, 'Đang tải dữ liệu tổng quan...');

    // 1. Fetch overview data
    const overviewDataResp = await this.getVinfastPartsTracking({
      ...query,
      page: 1,
      limit: 1000000,
    });
    const overviewData = overviewDataResp.data;
    const overviewItemCodes = new Set(overviewData.map((d: any) => d.itemCode));

    onProgress?.(30, totalProgressUnits, 'Đang tải dữ liệu chi tiết...');

    // 2. Fetch details data and filter by overview items
    let rawData = await this.getVinfastPartsTrackingDetails({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
    });
    rawData = rawData.filter((row: any) => overviewItemCodes.has(row.itemCode));

    onProgress?.(55, totalProgressUnits, 'Đang tạo workbook Excel...');

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

    onProgress?.(
      70,
      totalProgressUnits,
      'Đang tổng hợp dữ liệu theo phụ tùng...',
    );

    // ── Tổng hợp phụ tùng (all months combined, no month column) ──────────
    const summaryMap = new Map<
      string,
      {
        itemCode: string;
        itemName: string;
        vehicleType: string;
        qtyBought: number;
        qtySold: number;
        totalBuyAmount: number;
        totalSellAmount: number;
      }
    >();
    overviewData.forEach((row: any) => {
      const ex = summaryMap.get(row.itemCode);
      if (!ex) {
        summaryMap.set(row.itemCode, {
          itemCode: row.itemCode,
          itemName: row.itemName,
          vehicleType: row.vehicleType,
          qtyBought: Number(row.qtyBought || 0),
          qtySold: Number(row.qtySold || 0),
          totalBuyAmount:
            Number(row.avgBuyPrice || 0) * Number(row.qtyBought || 0),
          totalSellAmount:
            Number(row.avgSellPrice || 0) * Number(row.qtySold || 0),
        });
      } else {
        ex.qtyBought += Number(row.qtyBought || 0);
        ex.qtySold += Number(row.qtySold || 0);
        ex.totalBuyAmount +=
          Number(row.avgBuyPrice || 0) * Number(row.qtyBought || 0);
        ex.totalSellAmount +=
          Number(row.avgSellPrice || 0) * Number(row.qtySold || 0);
      }
    });
    const summaryRows = Array.from(summaryMap.values())
      .map((e) => {
        const avgBuyPrice =
          e.qtyBought > 0 ? Math.round(e.totalBuyAmount / e.qtyBought) : 0;
        const avgSellPrice =
          e.qtySold > 0 ? Math.round(e.totalSellAmount / e.qtySold) : 0;
        const hasSold = e.qtySold > 0;
        const margin = hasSold ? avgSellPrice - avgBuyPrice : null;
        const marginPct =
          hasSold && avgBuyPrice > 0
            ? (((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 100).toFixed(1) +
              '%'
            : '';
        return {
          itemCode: e.itemCode,
          itemName: e.itemName,
          vehicleType: e.vehicleType,
          qtyBought: e.qtyBought,
          avgBuyPrice,
          qtySold: e.qtySold,
          avgSellPrice,
          margin,
          marginPct,
        };
      })
      .sort((a, b) => a.itemCode.localeCompare(b.itemCode));

    const summarySheet = workbook.addWorksheet('Tổng hợp phụ tùng');
    summarySheet.columns = [
      { header: 'Mã phụ tùng', key: 'itemCode', width: 20 },
      { header: 'Tên phụ tùng', key: 'itemName', width: 40 },
      { header: 'Loại xe', key: 'vehicleType', width: 14 },
      { header: 'Tổng SL mua', key: 'qtyBought', width: 15 },
      { header: 'Giá mua TB', key: 'avgBuyPrice', width: 15 },
      { header: 'Tổng SL bán ra', key: 'qtySold', width: 15 },
      { header: 'Giá bán TB', key: 'avgSellPrice', width: 15 },
      { header: 'Biên LN', key: 'margin', width: 15 },
      { header: 'Biên LN (%)', key: 'marginPct', width: 15 },
    ] as any;
    setupSheetHeader(summarySheet, 9);
    summaryRows.forEach((row) => summarySheet.addRow(row));
    summarySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        [
          'qtyBought',
          'avgBuyPrice',
          'qtySold',
          'avgSellPrice',
          'margin',
        ].forEach((key) => {
          row.getCell(key).numFmt = '#,##0';
        });
      }
    });
    // ────────────────────────────────────────────────────────────────────────

    onProgress?.(80, totalProgressUnits, 'Đang tạo các sheet theo loại xe...');

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

    onProgress?.(95, totalProgressUnits, 'Đang đóng gói file XLSX...');

    const buffer = await workbook.xlsx.writeBuffer();
    const normalized = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);

    onProgress?.(100, totalProgressUnits, 'Đã tạo xong file XLSX.');

    return normalized;
  }

  async getVinfastPartsDashboardTableColumnOptions(query: {
    columnKey: string;
    search: string;
    page: number;
    limit: number;
    filtersStr: string;
    dateFrom?: string;
    dateTo?: string;
    vehicleType?: string;
  }) {
    const mapColumn: Record<string, string> = {
      itemCode: 'item_code',
      itemName: 'item_name',
      vehicleType: 'vehicle_type',
      qtyBought: 'qty_bought',
      qtySold: 'qty_sold',
      amountBought: 'amount_bought',
      amountSold: 'amount_sold',
      profit: '(amount_sold - amount_bought)',
    };

    const sqlCol = mapColumn[query.columnKey];
    if (!sqlCol) {
      return { items: [], total: 0, page: query.page, totalPages: 0 };
    }

    const params: any[] = [];
    let paramIndex = 1;
    let dateFilter = '';
    let vehicleTypeFilter = '';
    let otherFiltersSql = '';

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

    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');
    const inItemNameSql = this.buildVinfastInItemNameSql('ii.description');
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql(
      'c.item_code',
      'c.from_car_seller',
    );
    const vehicleTypeSelectSql = this.buildVinfastVehicleTypeSql(
      'c.item_code',
      'BOOL_OR(c.from_car_seller)',
    );

    if (query.vehicleType && query.vehicleType !== 'all') {
      vehicleTypeFilter = ` AND (${vehicleTypeSql}) = $${paramIndex}`;
      params.push(query.vehicleType);
      paramIndex++;
    }

    try {
      const filters = JSON.parse(query.filtersStr || '{}');
      for (const [key, vals] of Object.entries(filters)) {
        if (key === query.columnKey) continue;
        if (Array.isArray(vals) && vals.length > 0 && mapColumn[key]) {
          const placeholders = (vals as string[])
            .map(() => `$${paramIndex++}`)
            .join(', ');
          otherFiltersSql += ` AND ${mapColumn[key]}::text IN (${placeholders})`;
          params.push(...(vals as string[]));
        }
      }
    } catch (e) {}

    if (query.search) {
      otherFiltersSql += ` AND ${sqlCol}::text ILIKE $${paramIndex++}`;
      params.push(`%${query.search}%`);
    }

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
        SELECT 
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      sell_codes AS (
        SELECT 
          (${inItemCodeSql}) AS item_code,
          ii.quantity::numeric AS qty,
          (ii.quantity::numeric * ii.unit_price::numeric) AS amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      buy_agg AS (
        SELECT 
          item_code,
          MAX(item_name) AS item_name,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM buy_codes
        GROUP BY item_code, month
      ),
      sell_agg AS (
        SELECT 
          item_code,
          month,
          SUM(qty) AS total_qty,
          SUM(amount) AS total_amount,
          BOOL_OR(from_car_seller) AS from_car_seller
        FROM sell_codes
        GROUP BY item_code, month
      ),
      combined_data AS (
        SELECT
          COALESCE(b.item_code, s.item_code) AS item_code,
          COALESCE(b.item_name, '') AS item_name,
          COALESCE(b.month, s.month) AS month,
          COALESCE(b.total_qty, 0) AS qty_bought,
          COALESCE(s.total_qty, 0) AS qty_sold,
          COALESCE(b.total_amount, 0) AS amount_bought,
          COALESCE(s.total_amount, 0) AS amount_sold,
          COALESCE(b.from_car_seller, s.from_car_seller, false) AS from_car_seller
        FROM buy_agg b
        FULL OUTER JOIN sell_agg s ON s.item_code = b.item_code AND s.month = b.month
      ),
      base_data AS (
        SELECT 
          c.item_code,
          MAX(c.item_name) AS item_name,
          ${vehicleTypeSelectSql} AS vehicle_type,
          SUM(c.qty_bought) AS qty_bought,
          SUM(c.qty_sold) AS qty_sold,
          SUM(c.amount_bought) AS amount_bought,
          SUM(c.amount_sold) AS amount_sold
        FROM combined_data c
        WHERE 1=1
          ${dateFilter}
          ${vehicleTypeFilter}
        GROUP BY c.item_code
      ),
      filtered_data AS (
        SELECT DISTINCT ${sqlCol}::text AS value
        FROM base_data
        WHERE ${sqlCol} IS NOT NULL AND ${sqlCol}::text != ''
          ${otherFiltersSql}
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
    return {
      items: rows.map((r: any) => ({ value: r.value, label: r.value })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
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
    const vehicleTypeSql = this.buildVinfastVehicleTypeSql(
      'b.item_code',
      'BOOL_OR(b.from_car_seller)',
    );

    const sql = `
      WITH ${this.buildPurchasedItemCodesCteSql(inItemCodeSql)}
      buy_codes AS (
        SELECT 
          ii.invoice_id,
          ${inItemCodeSql} AS item_code,
          ${inItemNameSql} AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code IN (${this.vinfastSellerTaxCodesSql})
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
      ),
      sell_codes AS (
        SELECT 
          ii.invoice_id,
          (${inItemCodeSql}) AS item_code,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          p.from_car_seller
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
          JOIN purchased_item_codes p ON p.item_code = (${inItemCodeSql})
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
          AND (${inItemCodeSql}) IS NOT NULL
          AND (${inItemCodeSql}) <> ''
          AND (i.tax_invoice_status IS NULL OR i.tax_invoice_status != 4)
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

  // ---------------------------------------------------------------------------
  // VINFAST SETTLEMENT ORDERS
  // ---------------------------------------------------------------------------

  async getSettlementOrders(query: any) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const offset = (page - 1) * limit;

    let sortBy = query.sortBy || 'period';
    let sortDir = (query.sortDir || 'DESC').toUpperCase();
    if (sortDir !== 'ASC' && sortDir !== 'DESC') sortDir = 'DESC';

    const allowedSorts: Record<string, string> = {
      period: '"period"',
      settlementOrder: 'i.settlement_order',
      licensePlate: 'i.license_plate',
      invoiceCount: '"invoiceCount"',
      totalPreVat: '"totalPreVat"',
      totalVat: '"totalVat"',
      totalAmount: '"totalAmount"',
      totalNetoff: '"totalNetoff"',
      remaining: '"remaining"',
    };

    const orderByStr = allowedSorts[sortBy]
      ? `${allowedSorts[sortBy]} ${sortDir}`
      : `"period" DESC, i.settlement_order ASC`;

    const params: any[] = [];
    let paramIndex = 1;
    let whereSql = `i.direction = 'OUT' AND i.is_deleted = false AND i.settlement_order ILIKE '%-WO-%'`;

    if (query.dateFrom) {
      whereSql += ` AND i.invoice_date >= $${paramIndex++}`;
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereSql += ` AND i.invoice_date <= $${paramIndex++}`;
      params.push(query.dateTo);
    }

    // search
    if (query.search) {
      whereSql += ` AND (i.settlement_order ILIKE $${paramIndex} OR i.license_plate ILIKE $${paramIndex})`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    // column filters
    try {
      const filters = JSON.parse(query.columnFilters || '{}');
      if (filters.period && filters.period.length > 0) {
        const phs = filters.period.map(() => `$${paramIndex++}`).join(', ');
        whereSql += ` AND TO_CHAR(i.invoice_date, 'YYYY-MM') IN (${phs})`;
        params.push(...filters.period);
      }
      if (filters.settlementOrder && filters.settlementOrder.length > 0) {
        const phs = filters.settlementOrder
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereSql += ` AND i.settlement_order IN (${phs})`;
        params.push(...filters.settlementOrder);
      }
      if (filters.licensePlate && filters.licensePlate.length > 0) {
        const phs = filters.licensePlate
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereSql += ` AND i.license_plate IN (${phs})`;
        params.push(...filters.licensePlate);
      }
    } catch (e) {}

    // column search
    try {
      const colSearch = JSON.parse(query.columnSearch || '{}');
      if (colSearch.period) {
        whereSql += ` AND TO_CHAR(i.invoice_date, 'YYYY-MM') ILIKE $${paramIndex++}`;
        params.push(`%${colSearch.period}%`);
      }
      if (colSearch.settlementOrder) {
        whereSql += ` AND i.settlement_order ILIKE $${paramIndex++}`;
        params.push(`%${colSearch.settlementOrder}%`);
      }
      if (colSearch.licensePlate) {
        whereSql += ` AND i.license_plate ILIKE $${paramIndex++}`;
        params.push(`%${colSearch.licensePlate}%`);
      }
    } catch (e) {}

    const countSql = `
      SELECT COUNT(DISTINCT i.settlement_order || '_' || TO_CHAR(i.invoice_date, 'YYYY-MM')) AS total
      FROM erp_invoices i
      WHERE ${whereSql}
    `;

    const dataSql = `
      SELECT
        i.settlement_order AS "settlementOrder",
        TO_CHAR(i.invoice_date, 'YYYY-MM') AS period,
        i.license_plate AS "licensePlate",
        COUNT(*)::int AS "invoiceCount",
        SUM(i.pre_vat_amount)::numeric AS "totalPreVat",
        SUM(i.vat_amount)::numeric AS "totalVat",
        SUM(i.total_amount)::numeric AS "totalAmount",
        COALESCE(SUM(n.netoff_sum), 0)::numeric AS "totalNetoff",
        (SUM(i.total_amount) - COALESCE(SUM(n.netoff_sum), 0))::numeric AS remaining
      FROM erp_invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) AS netoff_sum
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) n ON n.invoice_id = i.id
      WHERE ${whereSql}
      GROUP BY i.settlement_order, period, i.license_plate
      ORDER BY ${orderByStr}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const countRes = await this.dataSource.query(countSql, params);
    const total = parseInt(countRes[0]?.total || '0', 10);

    params.push(limit, offset);
    const items = await this.dataSource.query(dataSql, params);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async exportSettlementOrdersExcel(query: any) {
    let sortBy = query.sortBy || 'period';
    let sortDir = (query.sortDir || 'DESC').toUpperCase();
    if (sortDir !== 'ASC' && sortDir !== 'DESC') sortDir = 'DESC';

    const allowedSorts: Record<string, string> = {
      period: '"period"',
      settlementOrder: 'i.settlement_order',
      licensePlate: 'i.license_plate',
      invoiceCount: '"invoiceCount"',
      totalPreVat: '"totalPreVat"',
      totalVat: '"totalVat"',
      totalAmount: '"totalAmount"',
      totalNetoff: '"totalNetoff"',
      remaining: '"remaining"',
    };

    const orderByStr = allowedSorts[sortBy]
      ? `${allowedSorts[sortBy]} ${sortDir}`
      : `"period" DESC, i.settlement_order ASC`;

    const params: any[] = [];
    let paramIndex = 1;
    let whereSql = `i.direction = 'OUT' AND i.is_deleted = false AND i.settlement_order ILIKE '%-WO-%'`;

    if (query.dateFrom) {
      whereSql += ` AND i.invoice_date >= $${paramIndex++}`;
      params.push(query.dateFrom);
    }

    if (query.dateTo) {
      whereSql += ` AND i.invoice_date <= $${paramIndex++}`;
      params.push(query.dateTo);
    }

    if (query.search) {
      whereSql += ` AND (i.settlement_order ILIKE $${paramIndex} OR i.license_plate ILIKE $${paramIndex})`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    try {
      const filters = JSON.parse(query.columnFilters || '{}');
      if (filters.period && filters.period.length > 0) {
        const phs = filters.period.map(() => `$${paramIndex++}`).join(', ');
        whereSql += ` AND TO_CHAR(i.invoice_date, 'YYYY-MM') IN (${phs})`;
        params.push(...filters.period);
      }
      if (filters.settlementOrder && filters.settlementOrder.length > 0) {
        const phs = filters.settlementOrder
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereSql += ` AND i.settlement_order IN (${phs})`;
        params.push(...filters.settlementOrder);
      }
      if (filters.licensePlate && filters.licensePlate.length > 0) {
        const phs = filters.licensePlate
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereSql += ` AND i.license_plate IN (${phs})`;
        params.push(...filters.licensePlate);
      }
    } catch (e) {}

    const dataSql = `
      SELECT
        i.settlement_order AS "settlementOrder",
        TO_CHAR(i.invoice_date, 'YYYY-MM') AS period,
        i.license_plate AS "licensePlate",
        COUNT(*)::int AS "invoiceCount",
        SUM(i.pre_vat_amount)::numeric AS "totalPreVat",
        SUM(i.vat_amount)::numeric AS "totalVat",
        SUM(i.total_amount)::numeric AS "totalAmount",
        COALESCE(SUM(n.netoff_sum), 0)::numeric AS "totalNetoff",
        (SUM(i.total_amount) - COALESCE(SUM(n.netoff_sum), 0))::numeric AS remaining
      FROM erp_invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) AS netoff_sum
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) n ON n.invoice_id = i.id
      WHERE ${whereSql}
      GROUP BY i.settlement_order, period, i.license_plate
      ORDER BY ${orderByStr}
    `;

    const overviewData = await this.dataSource.query(dataSql, params);
    const inItemCodeSql = this.buildVinfastInItemCodeSql('ii.description');

    const detailsSql = `
      SELECT
        TO_CHAR(i.invoice_date, 'YYYY-MM') AS period,
        i.settlement_order AS "settlementOrder",
        i.license_plate AS "licensePlate",
        i.id AS "invoiceId", 
        i.invoice_no AS "invoiceNo", 
        i.serial_no AS "serialNo", 
        TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS "invoiceDate", 
        i.status,
        i.buyer_name AS "buyerName", 
        i.buyer_tax_code AS "buyerTaxCode", 
        (${inItemCodeSql}) AS "itemCode",
        ii.description AS "description",
        ii.unit AS "unit",
        ii.quantity::numeric AS "qty",
        ii.unit_price::numeric AS "unitPrice",
        (ii.quantity::numeric * ii.unit_price::numeric) AS "preVatAmount",
        COALESCE(ii.vat_rate, i.vat_rate) AS "vatRate",
        COALESCE(
          NULLIF(ii.vat_amount::numeric, 0),
          CASE
            WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
            THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * (COALESCE(ii.vat_rate, i.vat_rate)::numeric))
            ELSE 0 
          END,
          0
        ) AS "vatAmount",
        (ii.quantity::numeric * ii.unit_price::numeric) + COALESCE(
          NULLIF(ii.vat_amount::numeric, 0),
          CASE
            WHEN COALESCE(ii.vat_rate, i.vat_rate)::numeric > 0 
            THEN ROUND((ii.quantity::numeric * ii.unit_price::numeric) * (COALESCE(ii.vat_rate, i.vat_rate)::numeric))
            ELSE 0 
          END,
          0
        ) AS "totalAmount",
        CASE 
          WHEN ROW_NUMBER() OVER (PARTITION BY i.id ORDER BY ii.id ASC) = 1 
          THEN COALESCE(n.netoff_sum, 0)::numeric 
          ELSE NULL 
        END AS "netoffAmount"
      FROM erp_invoices i
      JOIN erp_invoice_items ii ON ii.invoice_id = i.id
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) AS netoff_sum
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) n ON n.invoice_id = i.id
      WHERE ${whereSql}
      ORDER BY i.invoice_date ASC, i.invoice_no ASC, ii.id ASC
    `;

    const detailsData = await this.dataSource.query(detailsSql, params);

    const workbook = new ExcelJS.Workbook();

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

    const overviewSheet = workbook.addWorksheet('Tổng quan');
    overviewSheet.columns = [
      { header: 'Kỳ', key: 'period', width: 12 },
      { header: 'Lệnh quyết toán', key: 'settlementOrder', width: 30 },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Số lượng HĐ', key: 'invoiceCount', width: 15 },
      { header: 'Trước GTGT', key: 'totalPreVat', width: 20 },
      { header: 'Thuế GTGT', key: 'totalVat', width: 20 },
      { header: 'Thành tiền', key: 'totalAmount', width: 20 },
      { header: 'Đã cấn trừ', key: 'totalNetoff', width: 20 },
      { header: 'Còn lại', key: 'remaining', width: 20 },
    ];

    setupSheetHeader(overviewSheet, 9);

    overviewData.forEach((row: any) => {
      const parsedRow = {
        ...row,
        invoiceCount: parseInt(row.invoiceCount || '0', 10),
        totalPreVat: parseFloat(row.totalPreVat || '0'),
        totalVat: parseFloat(row.totalVat || '0'),
        totalAmount: parseFloat(row.totalAmount || '0'),
        totalNetoff: parseFloat(row.totalNetoff || '0'),
        remaining: parseFloat(row.remaining || '0'),
      };
      const r = overviewSheet.addRow(parsedRow);
      r.getCell(4).numFmt = '#,##0';
      r.getCell(5).numFmt = '#,##0';
      r.getCell(6).numFmt = '#,##0';
      r.getCell(7).numFmt = '#,##0';
      r.getCell(8).numFmt = '#,##0';
      r.getCell(9).numFmt = '#,##0';
    });

    const detailSheet = workbook.addWorksheet('Chi tiết');
    detailSheet.columns = [
      { header: 'Kỳ', key: 'period', width: 12 },
      { header: 'Lệnh quyết toán', key: 'settlementOrder', width: 30 },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Ngày HĐ', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu', key: 'serialNo', width: 15 },
      { header: 'Số HĐ', key: 'invoiceNo', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Khách hàng', key: 'buyerName', width: 40 },
      { header: 'MST', key: 'buyerTaxCode', width: 15 },
      { header: 'Mã phụ tùng', key: 'itemCode', width: 20 },
      { header: 'Tên phụ tùng', key: 'description', width: 40 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Số lượng', key: 'qty', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 20 },
      { header: 'Trước GTGT', key: 'preVatAmount', width: 20 },
      {
        header: 'Thuế suất',
        key: 'vatRate',
        width: 10,
        style: { numFmt: '0%' },
      },
      { header: 'Thuế GTGT', key: 'vatAmount', width: 20 },
      { header: 'Thành tiền', key: 'totalAmount', width: 20 },
      { header: 'Đã cấn trừ', key: 'netoffAmount', width: 20 },
    ];

    setupSheetHeader(detailSheet, 19);

    detailsData.forEach((row: any) => {
      const r = detailSheet.addRow({
        ...row,
        qty: parseFloat(row.qty || '0'),
        unitPrice: parseFloat(row.unitPrice || '0'),
        preVatAmount: parseFloat(row.preVatAmount || '0'),
        vatRate:
          row.vatRate != null && row.vatRate !== ''
            ? parseFloat(row.vatRate)
            : '',
        vatAmount: parseFloat(row.vatAmount || '0'),
        totalAmount: parseFloat(row.totalAmount || '0'),
        netoffAmount:
          row.netoffAmount != null ? parseFloat(row.netoffAmount || '0') : null,
      });
      r.getCell(13).numFmt = '#,##0.##';
      r.getCell(14).numFmt = '#,##0';
      r.getCell(15).numFmt = '#,##0';
      r.getCell(17).numFmt = '#,##0';
      r.getCell(18).numFmt = '#,##0';
      if (row.netoffAmount != null) {
        r.getCell(19).numFmt = '#,##0';
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any;
  }

  async getSettlementOrderDetails(query: any) {
    const { settlementOrder, period } = query;
    if (!settlementOrder || !period) {
      return [];
    }

    const sql = `
      SELECT
        i.id AS "invoiceId", 
        i.invoice_no AS "invoiceNo", 
        i.serial_no AS "serialNo", 
        TO_CHAR(i.invoice_date, 'YYYY-MM-DD') AS "invoiceDate", 
        i.status,
        i.buyer_name AS "buyerName", 
        i.buyer_tax_code AS "buyerTaxCode", 
        i.license_plate AS "licensePlate",
        i.pre_vat_amount::numeric AS "preVatAmount", 
        i.vat_rate AS "vatRate", 
        i.vat_amount::numeric AS "vatAmount", 
        i.total_amount::numeric AS "totalAmount",
        COALESCE(n.netoff_sum, 0)::numeric AS "netoffAmount"
      FROM erp_invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(net_off_amount) AS netoff_sum
        FROM erp_invoice_voucher_netoff
        GROUP BY invoice_id
      ) n ON n.invoice_id = i.id
      WHERE i.direction = 'OUT'
        AND i.is_deleted = false
        AND i.settlement_order = $1
        AND TO_CHAR(i.invoice_date, 'YYYY-MM') = $2
      ORDER BY i.invoice_date ASC, i.invoice_no ASC
    `;

    return this.dataSource.query(sql, [settlementOrder, period]);
  }

  async getSettlementOrderColumnOptions(query: any) {
    const { columnKey, filtersStr, search } = query;
    const limit = parseInt(query.limit || '20', 10);
    const page = parseInt(query.page || '1', 10);
    const offset = (page - 1) * limit;

    const mapColumn: Record<string, string> = {
      period: `TO_CHAR(i.invoice_date, 'YYYY-MM')`,
      settlementOrder: 'i.settlement_order',
      licensePlate: 'i.license_plate',
    };

    const sqlCol = mapColumn[columnKey];
    if (!sqlCol) {
      return { items: [], total: 0, page, totalPages: 0 };
    }

    const params: any[] = [];
    let paramIndex = 1;
    let whereSql = `i.direction = 'OUT' AND i.is_deleted = false AND i.settlement_order ILIKE '%-WO-%'`;

    try {
      const filters = JSON.parse(filtersStr || '{}');
      for (const [key, vals] of Object.entries(filters)) {
        if (key === columnKey) continue;
        const col = mapColumn[key];
        if (Array.isArray(vals) && vals.length > 0 && col) {
          const phs = vals.map(() => `$${paramIndex++}`).join(', ');
          whereSql += ` AND ${col}::text IN (${phs})`;
          params.push(...vals);
        }
      }
    } catch (e) {}

    if (search) {
      whereSql += ` AND ${sqlCol}::text ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    const sql = `
      WITH filtered_data AS (
        SELECT DISTINCT ${sqlCol}::text AS value
        FROM erp_invoices i
        WHERE ${whereSql}
        AND ${sqlCol} IS NOT NULL
        AND ${sqlCol}::text <> ''
      )
      SELECT value, COUNT(*) OVER() AS total_count
      FROM filtered_data
      ORDER BY value ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

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
