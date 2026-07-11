import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReportsCoreService {
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
          SUM(COALESCE(sol.amount::numeric, sol.qty_ordered::numeric * COALESCE(sol.unit_price::numeric, 0))) AS total_amount,
          SUM(
            CASE
              WHEN sol.qty_ordered::numeric > 0 THEN
                (COALESCE(sol.amount::numeric, sol.qty_ordered::numeric * COALESCE(sol.unit_price::numeric, 0))
                 * LEAST(sol.qty_delivered::numeric, sol.qty_ordered::numeric)
                 / sol.qty_ordered::numeric)
              ELSE 0
            END
          ) AS delivered_amount
        FROM erp_sales_order_lines sol
        GROUP BY sol.sales_order_id
      )
      SELECT
        COUNT(so.id)::int AS total_orders,
        COALESCE(SUM(lt.total_amount), 0)::numeric AS total_revenue,
        CASE
          WHEN COALESCE(SUM(lt.total_amount), 0) = 0 THEN 0
          ELSE ROUND(COALESCE(SUM(lt.delivered_amount), 0) * 100.0 / NULLIF(SUM(lt.total_amount), 0), 2)
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
          SUM(COALESCE(sol.amount::numeric, sol.qty_ordered::numeric * COALESCE(sol.unit_price::numeric, 0))) AS amount
        FROM erp_sales_orders so
        LEFT JOIN erp_sales_order_lines sol ON sol.sales_order_id = so.id
        WHERE so.is_deleted = false ${whereSql}
        GROUP BY DATE_TRUNC('month', so.order_date::date)
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') AS month,
        COALESCE(amount, 0)::numeric AS amount
      FROM monthly
      ORDER BY month ASC
    `;

    const topCustomersSql = `
      SELECT
        so.customer_id AS "customerId",
        COALESCE(bp.display_name, bp.name, 'Khách lẻ') AS "customerName",
        COUNT(DISTINCT so.id)::int AS orders,
        COALESCE(SUM(COALESCE(sol.amount::numeric, sol.qty_ordered::numeric * COALESCE(sol.unit_price::numeric, 0))), 0)::numeric AS amount
      FROM erp_sales_orders so
      LEFT JOIN erp_sales_order_lines sol ON sol.sales_order_id = so.id
      LEFT JOIN erp_business_partners bp ON bp.id = so.customer_id
      WHERE so.is_deleted = false ${whereSql}
      GROUP BY so.customer_id, bp.display_name, bp.name
      ORDER BY amount DESC, orders DESC
      LIMIT 10
    `;

    const [kpiRows, statusBreakdown, trend, topCustomers] = await Promise.all([
      this.dataSource.query(kpiSql, params),
      this.dataSource.query(statusSql, params),
      this.dataSource.query(trendSql, params),
      this.dataSource.query(topCustomersSql, params),
    ]);

    return {
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      kpi: {
        totalOrders: Number(kpiRows?.[0]?.total_orders || 0),
        totalRevenue: Number(kpiRows?.[0]?.total_revenue || 0),
        completionRate: Number(kpiRows?.[0]?.completion_rate || 0),
      },
      statusBreakdown: (statusBreakdown || []).map((row: any) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),
      trend: (trend || []).map((row: any) => ({
        month: row.month,
        amount: Number(row.amount || 0),
      })),
      topCustomers: (topCustomers || []).map((row: any) => ({
        customerId: row.customerId,
        customerName: row.customerName,
        orders: Number(row.orders || 0),
        amount: Number(row.amount || 0),
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
          SUM(COALESCE(pol.amount::numeric, pol.qty_ordered::numeric * COALESCE(pol.unit_price::numeric, 0))) AS total_amount,
          SUM(
            CASE
              WHEN pol.qty_ordered::numeric > 0 THEN
                (COALESCE(pol.amount::numeric, pol.qty_ordered::numeric * COALESCE(pol.unit_price::numeric, 0))
                 * LEAST(pol.qty_received::numeric, pol.qty_ordered::numeric)
                 / pol.qty_ordered::numeric)
              ELSE 0
            END
          ) AS received_amount
        FROM erp_purchase_order_lines pol
        GROUP BY pol.purchase_order_id
      )
      SELECT
        COUNT(po.id)::int AS total_orders,
        COALESCE(SUM(lt.total_amount), 0)::numeric AS total_purchase_amount,
        CASE
          WHEN COALESCE(SUM(lt.total_amount), 0) = 0 THEN 0
          ELSE ROUND(COALESCE(SUM(lt.received_amount), 0) * 100.0 / NULLIF(SUM(lt.total_amount), 0), 2)
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
          SUM(COALESCE(pol.amount::numeric, pol.qty_ordered::numeric * COALESCE(pol.unit_price::numeric, 0))) AS amount
        FROM erp_purchase_orders po
        LEFT JOIN erp_purchase_order_lines pol ON pol.purchase_order_id = po.id
        WHERE po.is_deleted = false ${whereSql}
        GROUP BY DATE_TRUNC('month', po.order_date::date)
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') AS month,
        COALESCE(amount, 0)::numeric AS amount
      FROM monthly
      ORDER BY month ASC
    `;

    const topSuppliersSql = `
      SELECT
        po.supplier_id AS "supplierId",
        COALESCE(bp.display_name, bp.name, 'NCC lẻ') AS "supplierName",
        COUNT(DISTINCT po.id)::int AS orders,
        COALESCE(SUM(COALESCE(pol.amount::numeric, pol.qty_ordered::numeric * COALESCE(pol.unit_price::numeric, 0))), 0)::numeric AS amount
      FROM erp_purchase_orders po
      LEFT JOIN erp_purchase_order_lines pol ON pol.purchase_order_id = po.id
      LEFT JOIN erp_business_partners bp ON bp.id = po.supplier_id
      WHERE po.is_deleted = false ${whereSql}
      GROUP BY po.supplier_id, bp.display_name, bp.name
      ORDER BY amount DESC, orders DESC
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
        totalPurchaseAmount: Number(kpiRows?.[0]?.total_purchase_amount || 0),
        completionRate: Number(kpiRows?.[0]?.completion_rate || 0),
      },
      statusBreakdown: (statusBreakdown || []).map((row: any) => ({
        status: row.status,
        count: Number(row.count || 0),
      })),
      trend: (trend || []).map((row: any) => ({
        month: row.month,
        amount: Number(row.amount || 0),
      })),
      topSuppliers: (topSuppliers || []).map((row: any) => ({
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        orders: Number(row.orders || 0),
        amount: Number(row.amount || 0),
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

  async getVinfastPartsTracking(query: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
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
      itemCode: 'b.item_code',
      month: 'b.month',
      qtyBought: 'COALESCE(SUM(b.qty), 0)',
      qtySold: 'COALESCE(SUM(s.qty), 0)',
      avgBuyPrice: 'COALESCE(ROUND(AVG(b.unit_price)), 0)',
      avgSellPrice: 'COALESCE(ROUND(AVG(s.unit_price)), 0)',
      margin:
        'COALESCE(ROUND(AVG(s.unit_price)), 0) - COALESCE(ROUND(AVG(b.unit_price)), 0)',
      marginPct:
        'CASE WHEN COALESCE(ROUND(AVG(b.unit_price)), 0) > 0 THEN ((COALESCE(ROUND(AVG(s.unit_price)), 0) - COALESCE(ROUND(AVG(b.unit_price)), 0)) / COALESCE(ROUND(AVG(b.unit_price)), 0)) ELSE 0 END',
    };

    let orderByClause = 'ORDER BY b.month DESC, b.item_code ASC';
    if (query.sortBy && sortMap[query.sortBy]) {
      const dir = query.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderByClause = `ORDER BY ${sortMap[query.sortBy]} ${dir}`;
    }

    const limit = query.limit || 50;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    const sql = `
      WITH buy_codes AS (
        SELECT 
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' - ', 1)) AS item_code,
          TRIM(SPLIT_PART(ii.description, ' - ', 2)) AS item_name,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          DATE_TRUNC('month', i.invoice_date::date) AS month
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND ii.description LIKE '% - %'
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
      )
      SELECT 
        b.item_code AS "itemCode",
        b.item_name AS "itemName",
        TO_CHAR(b.month, 'YYYY-MM') AS "month",
        SUM(b.qty) AS "qtyBought",
        SUM(s.qty) AS "qtySold",
        ROUND(AVG(b.unit_price)) AS "avgBuyPrice",
        ROUND(AVG(s.unit_price)) AS "avgSellPrice",
        ARRAY_AGG(DISTINCT b.invoice_id) AS "buyInvoiceIds",
        ARRAY_AGG(DISTINCT s.invoice_id) FILTER (WHERE s.invoice_id IS NOT NULL) AS "sellInvoiceIds",
        COUNT(*) OVER() AS "totalCount"
      FROM buy_codes b
      LEFT JOIN sell_codes s ON s.item_code = b.item_code AND s.month = b.month
      WHERE 1=1
        ${dateFilter}
        ${searchFilter}
      GROUP BY b.item_code, b.item_name, b.month
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
      const margin = avgSellPrice - avgBuyPrice;
      const marginPct = avgBuyPrice > 0 ? (margin / avgBuyPrice) * 100 : 0;

      return {
        itemCode: row.itemCode,
        itemName: row.itemName,
        month: row.month,
        buyInvoiceIds: row.buyInvoiceIds,
        sellInvoiceIds: row.sellInvoiceIds,
        qtyBought,
        qtySold,
        avgBuyPrice,
        avgSellPrice,
        margin,
        marginPct: marginPct.toFixed(1) + '%',
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

    const sql = `
      WITH buy_codes AS (
        SELECT 
          'IN' as direction,
          i.invoice_no,
          i.serial_no,
          i.status,
          i.seller_name AS partner_name,
          i.seller_tax_code AS tax_code,
          TO_CHAR(i.invoice_date, 'YYYY-MM-DD') as invoice_date,
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' - ', 1)) AS item_code,
          TRIM(SPLIT_PART(ii.description, ' - ', 2)) AS item_name,
          ii.unit,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          (ii.quantity::numeric * ii.unit_price::numeric) AS pre_vat_amount,
          COALESCE(ii.vat_rate, i.vat_rate) AS vat_rate,
          ii.vat_amount::numeric AS vat_amount,
          (ii.quantity::numeric * ii.unit_price::numeric) + ii.vat_amount::numeric AS total_amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          i.license_plate,
          i.settlement_order
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'IN'
          AND i.seller_tax_code = '0108926276'
          AND ii.description LIKE '% - %'
      ),
      sell_codes AS (
        SELECT 
          'OUT' as direction,
          i.invoice_no,
          i.serial_no,
          i.status,
          i.buyer_name AS partner_name,
          i.buyer_tax_code AS tax_code,
          TO_CHAR(i.invoice_date, 'YYYY-MM-DD') as invoice_date,
          ii.invoice_id,
          TRIM(SPLIT_PART(ii.description, ' ', 1)) AS item_code,
          '' AS item_name,
          ii.unit,
          ii.quantity::numeric AS qty,
          ii.unit_price::numeric AS unit_price,
          (ii.quantity::numeric * ii.unit_price::numeric) AS pre_vat_amount,
          COALESCE(ii.vat_rate, i.vat_rate) AS vat_rate,
          ii.vat_amount::numeric AS vat_amount,
          (ii.quantity::numeric * ii.unit_price::numeric) + ii.vat_amount::numeric AS total_amount,
          DATE_TRUNC('month', i.invoice_date::date) AS month,
          i.license_plate,
          i.settlement_order
        FROM erp_invoices i
        JOIN erp_invoice_items ii ON ii.invoice_id = i.id
        WHERE i.is_deleted = false
          AND i.direction = 'OUT'
          AND ii.quantity IS NOT NULL
          AND ii.quantity::numeric > 0
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
        c.unit,
        c.qty,
        c.unit_price AS "unitPrice",
        c.pre_vat_amount AS "preVatAmount",
        c.vat_rate AS "vatRate",
        c.vat_amount AS "vatAmount",
        c.total_amount AS "totalAmount",
        c.license_plate AS "licensePlate",
        c.settlement_order AS "settlementOrder",
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
  }) {
    const rawData = await this.getVinfastPartsTrackingDetails(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bảng kê phụ tùng');

    sheet.columns = [
      { header: 'Tháng', key: 'month', width: 12 },
      { header: 'Mã phụ tùng', key: 'itemCode', width: 15 },
      { header: 'Tên phụ tùng', key: 'itemName', width: 40 },
      { header: 'Phân loại', key: 'direction', width: 12 },
      { header: 'Ngày hóa đơn', key: 'invoiceDate', width: 15 },
      { header: 'Ký hiệu hóa đơn', key: 'serialNo', width: 15 },
      { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Tên đối tác', key: 'partnerName', width: 40 },
      { header: 'Mã số thuế', key: 'taxCode', width: 15 },
      { header: 'Đơn vị tính', key: 'unit', width: 12 },
      { header: 'Số lượng', key: 'qty', width: 12 },
      { header: 'Đơn giá', key: 'unitPrice', width: 20 },
      { header: 'Tiền trước thuế', key: 'preVatAmount', width: 20 },
      {
        header: 'Thuế suất VAT (%)',
        key: 'vatRate',
        width: 15,
        style: { numFmt: '0%' },
      },
      { header: 'Tiền thuế VAT', key: 'vatAmount', width: 20 },
      { header: 'Thành tiền', key: 'totalAmount', width: 20 },
      { header: 'Biển số xe', key: 'licensePlate', width: 15 },
      { header: 'Lệnh sửa chữa', key: 'settlementOrder', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columns.length },
    };

    const parseVat = (val: any) => {
      if (!val) return '';
      const n = parseFloat(val);
      return isNaN(n) ? val : n / 100;
    };

    rawData.forEach((row: any) => {
      sheet.addRow({
        month: row.month,
        itemCode: row.itemCode,
        itemName: row.itemName,
        direction: row.direction === 'IN' ? 'Mua vào' : 'Bán ra',
        invoiceDate: row.invoiceDate,
        serialNo: row.serialNo,
        invoiceNo: row.invoiceNo,
        status: row.status,
        partnerName: row.partnerName,
        taxCode: row.taxCode,
        unit: row.unit,
        qty: parseFloat(row.qty || '0'),
        unitPrice: parseFloat(row.unitPrice || '0'),
        preVatAmount: parseFloat(row.preVatAmount || '0'),
        vatRate: parseVat(row.vatRate),
        vatAmount: parseFloat(row.vatAmount || '0'),
        totalAmount: parseFloat(row.totalAmount || '0'),
        licensePlate: row.licensePlate,
        settlementOrder: row.settlementOrder,
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

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as any;
  }
}
