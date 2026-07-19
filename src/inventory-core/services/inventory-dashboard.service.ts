import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InventoryDashboardQueryDto } from '../dto/inventory-dashboard-query.dto';

@Injectable()
export class InventoryDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboardStats(query: InventoryDashboardQueryDto) {
    const start = query.startDate ? new Date(query.startDate) : null;
    const end = query.endDate ? new Date(query.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    // Find BOM 'xe đen'
    const boms = await this.dataSource.query(
      `SELECT id FROM erp_boms WHERE bom_name ILIKE '%xe đen%' OR bom_code ILIKE '%den%' OR bom_code ILIKE '%black%' LIMIT 1`,
    );
    const bomId = boms.length ? boms[0].id : null;
    let bomLines: { component_item_id: string; qty_required: string }[] = [];
    if (bomId) {
      bomLines = await this.dataSource.query(
        `SELECT component_item_id, qty_required FROM erp_bom_lines WHERE bom_id = $1`,
        [bomId],
      );
    }
    const lowStockThresholdMap = new Map<string, number>();
    for (const line of bomLines) {
      if (line.component_item_id) {
        lowStockThresholdMap.set(
          line.component_item_id,
          parseFloat(line.qty_required) * 5,
        );
      }
    }

    // Fetch all active items with their balances
    const itemParams: any[] = [];
    let itemWhere = `WHERE i.is_deleted = false`;
    if (query.warehouseCode) {
      itemParams.push(query.warehouseCode);
      itemWhere += ` AND b.warehouse_code = $1`;
    }

    const items = await this.dataSource.query(
      `
      SELECT 
        i.id as item_id, i.sku, i.item_name as item_name, 
        t.id as type_id, t.name as type_name,
        COALESCE(b.qty_on_hand, 0) as qty,
        COALESCE(b.avg_unit_cost, 0) as cost,
        (
          SELECT MAX(transaction_date) 
          FROM erp_inventory_transactions txn 
          WHERE txn.item_id = i.id AND txn.transaction_type = 'ISSUE'
        ) as last_issue_date
      FROM erp_inventory_items i
      LEFT JOIN erp_inventory_balances b ON i.id = b.item_id
      LEFT JOIN erp_item_types t ON i.item_type_id = t.id
      ${itemWhere}
    `,
      itemParams,
    );

    let totalStockValue = 0;
    let zeroStockCount = 0;
    let lowStockCount = 0;
    const typeBreakdownMap = new Map<
      string,
      { id: string; name: string; qty: number; value: number }
    >();
    const alertItems: any[] = [];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    for (const item of items) {
      const qty = parseFloat(item.qty);
      const cost = parseFloat(item.cost);
      const value = qty * cost;
      totalStockValue += value;

      if (item.type_id) {
        if (!typeBreakdownMap.has(item.type_id)) {
          typeBreakdownMap.set(item.type_id, {
            id: item.type_id,
            name: item.type_name,
            qty: 0,
            value: 0,
          });
        }
        typeBreakdownMap.get(item.type_id)!.value += value;
        typeBreakdownMap.get(item.type_id)!.qty += qty;
      }

      const threshold = lowStockThresholdMap.get(item.item_id) || 5;

      if (qty <= 0) {
        zeroStockCount++;
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'zero_stock',
        });
      } else if (qty < threshold) {
        lowStockCount++;
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'low_stock',
        });
      } else if (
        !item.last_issue_date ||
        new Date(item.last_issue_date) < ninetyDaysAgo
      ) {
        alertItems.push({
          itemId: item.item_id,
          sku: item.sku,
          itemName: item.item_name,
          qtyOnHand: qty,
          lastIssueDate: item.last_issue_date,
          alertType: 'slow_moving',
        });
      }
    }

    alertItems.sort((a, b) => a.qtyOnHand - b.qtyOnHand);

    const totalStockQty = Array.from(typeBreakdownMap.values()).reduce(
      (acc, t) => acc + t.qty,
      0,
    );
    const typeBreakdown = Array.from(typeBreakdownMap.values())
      .map((t) => ({
        itemTypeId: t.id,
        itemTypeName: t.name,
        stockValue: t.value,
        stockQty: t.qty,
        percentage: totalStockQty > 0 ? (t.qty / totalStockQty) * 100 : 0,
      }))
      .sort((a, b) => b.stockQty - a.stockQty);

    const topStockItems = [...items]
      .sort(
        (a, b) =>
          parseFloat(b.qty) * parseFloat(b.cost) -
          parseFloat(a.qty) * parseFloat(a.cost),
      )
      .slice(0, 20)
      .map((item) => ({
        itemId: item.item_id,
        sku: item.sku,
        itemName: item.item_name,
        itemTypeName: item.type_name,
        qtyOnHand: parseFloat(item.qty),
        unitCost: parseFloat(item.cost),
        stockValue: parseFloat(item.qty) * parseFloat(item.cost),
      }));

    // Transactions for Trend & Issued Items
    let txnWhere = `WHERE 1=1`;
    const txnParams: any[] = [];
    if (start) {
      txnParams.push(start);
      txnWhere += ` AND transaction_date >= $${txnParams.length}`;
    }
    if (end) {
      txnParams.push(end);
      txnWhere += ` AND transaction_date <= $${txnParams.length}`;
    }
    if (query.warehouseCode) {
      txnParams.push(query.warehouseCode);
      txnWhere += ` AND warehouse_code = $${txnParams.length}`;
    }

    const txns = await this.dataSource.query(
      `
      SELECT 
        transaction_type, document_id, item_id, qty_in, qty_out, unit_cost, transaction_date
      FROM erp_inventory_transactions
      ${txnWhere}
    `,
      txnParams,
    );

    const receiptDocIds = new Set();
    const issueDocIds = new Set();
    const issuedItemsMap = new Map<string, number>();
    const trendMap = new Map<string, any>();

    const isMonthView =
      !start ||
      !end ||
      end.getTime() - start.getTime() > 30 * 24 * 60 * 60 * 1000;

    for (const txn of txns) {
      const dt = new Date(txn.transaction_date);
      const trendKey = isMonthView
        ? `T${dt.getMonth() + 1}/${dt.getFullYear().toString().substring(2)}`
        : `${dt.getDate()}/${dt.getMonth() + 1}`;

      if (!trendMap.has(trendKey)) {
        trendMap.set(trendKey, {
          label: trendKey,
          receiptValue: 0,
          issueValue: 0,
          receiptQty: 0,
          issueQty: 0,
          _date: dt,
        });
      }
      const t = trendMap.get(trendKey);
      const cost = parseFloat(txn.unit_cost || 0);

      if (txn.transaction_type === 'RECEIPT') {
        if (txn.document_id) receiptDocIds.add(txn.document_id);
        t.receiptQty += parseFloat(txn.qty_in || '0');
        t.receiptValue += parseFloat(txn.qty_in || '0') * cost;
      } else if (txn.transaction_type === 'ISSUE') {
        if (txn.document_id) issueDocIds.add(txn.document_id);
        t.issueQty += parseFloat(txn.qty_out || '0');
        t.issueValue += parseFloat(txn.qty_out || '0') * cost;

        const currentQty = issuedItemsMap.get(txn.item_id) || 0;
        issuedItemsMap.set(
          txn.item_id,
          currentQty + parseFloat(txn.qty_out || '0'),
        );
      }
    }

    const stockTrend = Array.from(trendMap.values())
      .sort((a, b) => a._date.getTime() - b._date.getTime())
      .map((t) => {
        delete t._date;
        return t;
      });

    const topIssuedItems = Array.from(issuedItemsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([itemId, totalIssued]) => {
        const item = items.find((i: any) => i.item_id === itemId);
        return {
          itemId,
          sku: item?.sku || '',
          itemName: item?.item_name || '',
          itemTypeName: item?.type_name || '',
          totalIssued,
          currentStock: item ? parseFloat(item.qty) : 0,
        };
      });

    // Calculate vehicleBomStats and vehicleTrend
    let vehicleWhere = `WHERE 1=1`;
    const vehicleParams: any[] = [];
    if (start) {
      vehicleParams.push(start);
      vehicleWhere += ` AND (s.created_at >= $${vehicleParams.length} OR s.updated_at >= $${vehicleParams.length})`;
    }
    if (end) {
      vehicleParams.push(end);
      vehicleWhere += ` AND (s.created_at <= $${vehicleParams.length} OR s.updated_at <= $${vehicleParams.length})`;
    }

    // We get all serials that are linked to a BOM via MO.
    const vehicleQuery = `
      SELECT 
        b.bom_name,
        s.status,
        s.created_at,
        s.updated_at
      FROM erp_inventory_tracking_serials s
      JOIN erp_production_orders po ON s.production_order_id = po.id
      JOIN erp_boms b ON (po.output_metadata->>'bomId')::uuid = b.id
      ${vehicleWhere}
    `;

    const serialsRaw = await this.dataSource.query(vehicleQuery, vehicleParams);

    const vehicleBomStatsMap = new Map<
      string,
      {
        bomName: string;
        currentStock: number;
        issuedInPeriod: number;
        receivedInPeriod: number;
      }
    >();
    const vehicleTrendMap = new Map<
      string,
      {
        periodLabel: string;
        _date: Date;
        receiptsByBom: Record<string, number>;
        issuesByBom: Record<string, number>;
      }
    >();

    for (const s of serialsRaw) {
      const bomName = s.bom_name;
      if (!vehicleBomStatsMap.has(bomName)) {
        vehicleBomStatsMap.set(bomName, {
          bomName,
          currentStock: 0,
          issuedInPeriod: 0,
          receivedInPeriod: 0,
        });
      }
      const stat = vehicleBomStatsMap.get(bomName)!;

      if (s.status === 'IN_STOCK') {
        stat.currentStock++;
      }

      const createdDt = new Date(s.created_at);
      const updatedDt = new Date(s.updated_at);

      const createdInPeriod =
        (!start || createdDt >= start) && (!end || createdDt <= end);
      const updatedInPeriod =
        (!start || updatedDt >= start) && (!end || updatedDt <= end);

      if (createdInPeriod) {
        stat.receivedInPeriod++;

        // Add to Trend
        const trendKey = isMonthView
          ? `T${createdDt.getMonth() + 1}/${createdDt.getFullYear().toString().substring(2)}`
          : `${createdDt.getDate()}/${createdDt.getMonth() + 1}`;
        if (!vehicleTrendMap.has(trendKey)) {
          vehicleTrendMap.set(trendKey, {
            periodLabel: trendKey,
            _date: createdDt,
            receiptsByBom: {},
            issuesByBom: {},
          });
        }
        const t = vehicleTrendMap.get(trendKey)!;
        t.receiptsByBom[bomName] = (t.receiptsByBom[bomName] || 0) + 1;
      }

      if (s.status === 'SOLD' && updatedInPeriod) {
        stat.issuedInPeriod++;

        // Add to Trend
        const trendKey = isMonthView
          ? `T${updatedDt.getMonth() + 1}/${updatedDt.getFullYear().toString().substring(2)}`
          : `${updatedDt.getDate()}/${updatedDt.getMonth() + 1}`;
        if (!vehicleTrendMap.has(trendKey)) {
          vehicleTrendMap.set(trendKey, {
            periodLabel: trendKey,
            _date: updatedDt,
            receiptsByBom: {},
            issuesByBom: {},
          });
        }
        const t = vehicleTrendMap.get(trendKey)!;
        t.issuesByBom[bomName] = (t.issuesByBom[bomName] || 0) + 1;
      }
    }

    const vehicleBomStats = Array.from(vehicleBomStatsMap.values());
    const vehicleTrend = Array.from(vehicleTrendMap.values())
      .sort((a, b) => a._date.getTime() - b._date.getTime())
      .map((t) => {
        const { _date, ...rest } = t;
        return rest;
      });

    return {
      message: 'Lấy dữ liệu tổng quan kho thành công',
      data: {
        totalSkus: items.length,
        totalStockValue,
        totalReceiptsCount: receiptDocIds.size,
        totalIssuesCount: issueDocIds.size,
        lowStockCount,
        zeroStockCount,
        stockTrend,
        typeBreakdown,
        topStockItems,
        topIssuedItems,
        alertItems,
        vehicleBomStats,
        vehicleTrend,
      },
    };
  }
}
