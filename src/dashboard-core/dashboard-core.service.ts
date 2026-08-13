import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReportsCoreService } from '../reports-core/reports-core.service';
import { InventoryItemsService } from '../inventory-core/inventory-core.service';
import { BankTransactionsCoreService } from '../bank-transactions-core/bank-transactions-core.service';
import { InvoiceDashboardService } from '../erp-invoices-core/invoice-dashboard.service';
import { OperationalDocumentsService } from '../operational-documents/operational-documents.service';
import { PurchaseOrdersCoreService } from '../purchase-orders-core/purchase-orders-core.service';
import { OperatingExpensesCoreService } from '../operating-expenses-core/operating-expenses-core.service';

@Injectable()
export class DashboardCoreService {
  constructor(
    private readonly reportsCoreService: ReportsCoreService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly bankTransactionsService: BankTransactionsCoreService,
    private readonly invoiceDashboardService: InvoiceDashboardService,
    private readonly operationalDocumentsService: OperationalDocumentsService,
    private readonly purchaseOrdersCoreService: PurchaseOrdersCoreService,
    private readonly operatingExpensesCoreService: OperatingExpensesCoreService,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(query: any) {
    const [salesStats, purchasingStats, inventoryStats, cashflowStats] =
      await Promise.all([
        // Sales
        this.reportsCoreService
          .getSalesDashboard({
            dateFrom: query.startDate,
            dateTo: query.endDate,
          })
          .catch((err) => {
            console.error('Failed to get sales stats', err);
            return null;
          }),

        // Purchasing
        this.reportsCoreService
          .getPurchasingDashboard({
            dateFrom: query.startDate,
            dateTo: query.endDate,
          })
          .catch((err) => {
            console.error('Failed to get purchasing stats', err);
            return null;
          }),

        // Inventory
        this.inventoryItemsService
          .getDashboardStats({
            startDate: query.startDate,
            endDate: query.endDate,
          })
          .then((res) => res?.data || res)
          .catch((err) => {
            console.error('Failed to get inventory stats', err);
            return null;
          }),

        // Cashflow (Bank Statements)
        this.bankTransactionsService
          .getDashboardStats({
            startDate: query.startDate,
            endDate: query.endDate,
            branchId: query.branchId,
          })
          .catch((err) => {
            console.error('Failed to get cashflow stats', err);
            return null;
          }),
      ]);

    // Format the aggregated response
    return {
      sales: salesStats,
      purchasing: purchasingStats,
      inventory: inventoryStats,
      cashflow: cashflowStats,
    };
  }

  async getCashflowForecast(query: any) {
    // 1. Get past cash out for the last 3 months to present
    const date3MonthsAgo = new Date();
    date3MonthsAgo.setMonth(date3MonthsAgo.getMonth() - 3);
    const startDate = date3MonthsAgo.toISOString().substring(0, 10);
    const today = new Date().toISOString().substring(0, 10);

    let pastCashOut = [];
    try {
      const bankStats = await this.bankTransactionsService.getDashboardStats({
        startDate,
        endDate: today,
        branchId: query.branchId,
      });
      // The bank stats includes totalCashIn, totalCashOut, trendMap (which might be exposed differently, let's just return what we can).
      // We know bankStats is any because it's not strongly typed in the method return, but looking at bankTransactionsService:
      // it returns { totalCashIn, totalCashOut, trend: Array.from(trendMap.entries()).map(([k,v]) => ({ date: k, ...v })) }
      pastCashOut = (bankStats as any).trend || [];
    } catch (err) {
      console.error('Failed to get past cash out', err);
    }

    // 2. Fetch budget forecast data (unpaid liabilities & future recurring)
    let forecastData: { unpaidLiabilities: any[]; recurringDocs: any[] } = {
      unpaidLiabilities: [],
      recurringDocs: [],
    };
    try {
      const [unpaidPO, unpaidOE, recurringPO, recurringOE] = await Promise.all([
        this.purchaseOrdersCoreService.findUnpaid(),
        this.operatingExpensesCoreService.findUnpaid(),
        this.purchaseOrdersCoreService.findRecurring(),
        this.operatingExpensesCoreService.findRecurring(),
      ]);

      forecastData = {
        unpaidLiabilities: [
          ...unpaidPO.map((i) => ({ ...i, collection: 'purchase_orders' })),
          ...unpaidOE.map((i) => ({ ...i, collection: 'operating_expenses' })),
        ],
        recurringDocs: [
          ...recurringPO.map((i) => ({ ...i, collection: 'purchase_orders' })),
          ...recurringOE.map((i) => ({
            ...i,
            collection: 'operating_expenses',
          })),
        ],
      };
    } catch (err) {
      console.error('Failed to get budget forecast data', err);
    }

    return {
      past: pastCashOut,
      presentLiabilities: forecastData.unpaidLiabilities,
      futureProjections: forecastData.recurringDocs,
    };
  }

  async getBudgetSuggestions(query: any) {
    const suggestions: any[] = [];
    try {
      const date6MonthsAgo = new Date();
      date6MonthsAgo.setMonth(date6MonthsAgo.getMonth() - 6);
      const startDate = date6MonthsAgo.toISOString().substring(0, 10);

      const queryParams: any[] = [startDate, 'OUT', false];
      let branchFilter = '';

      if (query.branchId) {
        branchFilter = ' AND branch_id = $4';
        queryParams.push(query.branchId);
      }

      // Group by correspondent_name, filtering for those with >= 2 occurrences in different months
      const sql = `
        SELECT 
          correspondent_name as title,
          AVG(amount) as "avgAmount",
          COUNT(id) as occurrences,
          MAX(trans_date) as "lastDate",
          COUNT(DISTINCT TO_CHAR(trans_date, 'YYYY-MM')) as months_count
        FROM erp_bank_transactions
        WHERE trans_date >= $1 
          AND transaction_type = $2 
          AND is_deleted = $3
          AND correspondent_name IS NOT NULL
          AND correspondent_name != ''
          ${branchFilter}
        GROUP BY correspondent_name
        HAVING COUNT(DISTINCT TO_CHAR(trans_date, 'YYYY-MM')) >= 2
        ORDER BY occurrences DESC
      `;

      const results = await this.dataSource.query(sql, queryParams);

      if (results && results.length > 0) {
        suggestions.push({
          type: 'bank_statement',
          title: 'Gợi ý từ sao kê ngân hàng',
          items: results.map((row: any) => ({
            title: row.title,
            avgAmount: Number(row.avgAmount),
            occurrences: Number(row.occurrences),
            lastDate: row.lastDate,
          })),
        });
      } else {
        suggestions.push({
          type: 'bank_statement',
          title: 'Gợi ý từ sao kê ngân hàng',
          items: [],
        });
      }
    } catch (err) {
      console.error('Failed to get budget suggestions', err);
      suggestions.push({
        type: 'bank_statement',
        title: 'Gợi ý từ sao kê ngân hàng',
        items: [],
      });
    }
    return suggestions;
  }
}
