import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardStatsService } from './services/admin-dashboard-stats.service';
import { AdminDashboardSummaryResponseDto } from './dto/admin-dashboard-summary.dto';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let statsService: Partial<AdminDashboardStatsService>;

  const mockResponse: AdminDashboardSummaryResponseDto = {
    kpis: {
      revenue: { value: 1000000, growthRate: 10 },
      salesOrdersCount: { value: 20, pendingCount: 2 },
      inventoryLowStockCount: { value: 3 },
      unpaidReceivables: { value: 150000 },
    },
    recentPendingApprovals: [],
    systemHealth: {
      activeUsers: 5,
      lastSyncAt: '2026-10-30T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    statsService = {
      getSummary: jest.fn().mockResolvedValue(mockResponse),
    };
    controller = new AdminDashboardController(
      statsService as AdminDashboardStatsService,
    );
  });

  it('should call service.getSummary and return response', async () => {
    const result = await controller.getSummary({ period: 'month' });

    expect(statsService.getSummary).toHaveBeenCalledWith({ period: 'month' });
    expect(result).toEqual(mockResponse);
  });
});
