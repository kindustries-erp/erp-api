import { Injectable } from '@nestjs/common';
import { ReportsCoreService } from '../reports-core/reports-core.service';
import { InventoryItemsService } from '../inventory-core/inventory-core.service';
import { BankTransactionsCoreService } from '../bank-transactions-core/bank-transactions-core.service';
import { InvoiceDashboardService } from '../erp-invoices-core/invoice-dashboard.service';

@Injectable()
export class DashboardCoreService {
  constructor(
    private readonly reportsCoreService: ReportsCoreService,
    private readonly inventoryItemsService: InventoryItemsService,
    private readonly bankTransactionsService: BankTransactionsCoreService,
    private readonly invoiceDashboardService: InvoiceDashboardService,
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
}
