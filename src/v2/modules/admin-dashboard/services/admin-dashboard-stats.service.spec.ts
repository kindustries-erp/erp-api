import { AdminDashboardStatsService } from './admin-dashboard-stats.service';
import { DashboardCoreService } from '@/dashboard-core/dashboard-core.service';
import { DataSource } from 'typeorm';

describe('AdminDashboardStatsService', () => {
  let service: AdminDashboardStatsService;
  let dashboardCoreService: Partial<DashboardCoreService>;
  let dataSource: Partial<DataSource>;

  beforeEach(() => {
    dashboardCoreService = {
      getOverview: jest.fn().mockResolvedValue({
        sales: { kpi: { totalOrders: 25, totalQty: 100, completionRate: 0.9 } },
        inventory: { lowStockCount: 5 },
        cashflow: { totalCashIn: 1500000, totalReceivables: 450000 },
      } as any),
    };

    dataSource = {
      query: jest.fn().mockResolvedValue([{ count: 8 }]),
    };

    service = new AdminDashboardStatsService(
      dashboardCoreService as DashboardCoreService,
      dataSource as DataSource,
    );
  });

  it('should return aggregated KPI summary successfully', async () => {
    const result = await service.getSummary({ period: 'month' });

    expect(result.kpis.revenue.value).toBe(1500000);
    expect(result.kpis.salesOrdersCount.value).toBe(25);
    expect(result.kpis.inventoryLowStockCount.value).toBe(5);
    expect(result.kpis.unpaidReceivables.value).toBe(450000);
    expect(result.systemHealth.activeUsers).toBe(8);
  });

  it('should handle service error gracefully and return fallback zeroes', async () => {
    (dashboardCoreService.getOverview as jest.Mock).mockRejectedValue(
      new Error('DB failure'),
    );

    const result = await service.getSummary({});

    expect(result.kpis.revenue.value).toBe(0);
    expect(result.kpis.salesOrdersCount.value).toBe(0);
    expect(result.systemHealth.activeUsers).toBe(1);
  });
});
