import { Test, TestingModule } from '@nestjs/testing';
import { GarageDashboardService } from './garage-dashboard.service';
import { GarageDashboardStatsService } from './services/garage-dashboard-stats.service';
import { GarageCheckpointService } from './services/garage-checkpoint.service';
import { GarageCustomerStatsService } from './services/garage-customer-stats.service';
import { GaragePnlService } from './services/garage-pnl.service';
import { GarageMonthlyReceivablesBreakdownService } from './services/garage-monthly-receivables-breakdown.service';
import { GaragePeriodReportQueries } from './services/garage-period-report-queries.service';

describe('GarageDashboardService (Facade)', () => {
  let service: GarageDashboardService;
  let mockStatsService: any;
  let mockCheckpointService: any;
  let mockCustomerStatsService: any;
  let mockPnlService: any;
  let mockMonthlyBreakdownService: any;
  let mockPeriodQueries: any;

  beforeEach(async () => {
    mockStatsService = {
      getDashboardStats: jest.fn().mockResolvedValue({ trend: [] }),
    };

    mockCheckpointService = {
      getCheckpointKpis: jest.fn().mockResolvedValue({ month: {} }),
      getCheckpointCases: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    mockCustomerStatsService = {
      getCustomersStats: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    mockPnlService = {
      getPnlReport: jest.fn().mockResolvedValue({ grossProfit: 100 }),
      getCombinedOpexList: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getVirtualOpexById: jest.fn().mockResolvedValue({ id: 'test' }),
      exportPnlExcel: jest.fn().mockResolvedValue(Buffer.from('pnl-excel')),
    };

    mockMonthlyBreakdownService = {
      getMonthlyReceivablesBreakdown: jest
        .fn()
        .mockResolvedValue({ month: '2026-10' }),
    };

    mockPeriodQueries = {
      loadPnlMonthly: jest.fn().mockResolvedValue([
        {
          year: 2026,
          month: 10,
          revenue: 100,
          cogs: 60,
          grossProfit: 40,
          grossMarginRate: 40,
          opexTotal: 0,
          opexItems: [],
          netBeforeCommission: 40,
          commissionTotal: 0,
          commissionItems: [],
          netAfterCommission: 40,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageDashboardService,
        { provide: GarageDashboardStatsService, useValue: mockStatsService },
        { provide: GarageCheckpointService, useValue: mockCheckpointService },
        {
          provide: GarageCustomerStatsService,
          useValue: mockCustomerStatsService,
        },
        { provide: GaragePnlService, useValue: mockPnlService },
        {
          provide: GarageMonthlyReceivablesBreakdownService,
          useValue: mockMonthlyBreakdownService,
        },
        { provide: GaragePeriodReportQueries, useValue: mockPeriodQueries },
      ],
    }).compile();

    service = module.get<GarageDashboardService>(GarageDashboardService);
  });

  it('delegates getDashboardStats to statsService', async () => {
    await service.getDashboardStats('2026-01-01', '2026-01-31');
    expect(mockStatsService.getDashboardStats).toHaveBeenCalledWith(
      '2026-01-01',
      '2026-01-31',
    );
  });

  it('delegates getCheckpointKpis to checkpointService', async () => {
    await service.getCheckpointKpis();
    expect(mockCheckpointService.getCheckpointKpis).toHaveBeenCalled();
  });

  it('delegates getCheckpointCases to checkpointService', async () => {
    await service.getCheckpointCases(
      '2026-01-01',
      '2026-01-31',
      1,
      20,
      'search',
      'paid',
      'SUA_CHUA_CHUNG',
      'ngayHoanThanhCongViec',
      'DESC',
    );
    expect(mockCheckpointService.getCheckpointCases).toHaveBeenCalledWith(
      '2026-01-01',
      '2026-01-31',
      1,
      20,
      'search',
      'paid',
      'SUA_CHUA_CHUNG',
      'ngayHoanThanhCongViec',
      'DESC',
    );
  });

  it('delegates getCustomersStats to customerStatsService', async () => {
    await service.getCustomersStats(
      1,
      20,
      'test',
      '2026-01-01',
      '2026-01-31',
      'totalRevenue',
      'DESC',
      '{}',
      '{}',
    );
    expect(mockCustomerStatsService.getCustomersStats).toHaveBeenCalledWith(
      1,
      20,
      'test',
      '2026-01-01',
      '2026-01-31',
      'totalRevenue',
      'DESC',
      '{}',
      '{}',
    );
  });

  it('delegates getPnlReport to pnlService', async () => {
    await service.getPnlReport(2026, 7);
    expect(mockPnlService.getPnlReport).toHaveBeenCalledWith(2026, 7);
  });

  it('delegates getCombinedOpexList to pnlService', async () => {
    const query = { year: 2026, month: 7 } as any;
    await service.getCombinedOpexList(query);
    expect(mockPnlService.getCombinedOpexList).toHaveBeenCalledWith(query);
  });

  it('delegates getVirtualOpexById to pnlService', async () => {
    await service.getVirtualOpexById('auto-sale-2026-07');
    expect(mockPnlService.getVirtualOpexById).toHaveBeenCalledWith(
      'auto-sale-2026-07',
    );
  });

  it('delegates exportPnlExcel to pnlService', async () => {
    const res = await service.exportPnlExcel(2026, 7);
    expect(mockPnlService.exportPnlExcel).toHaveBeenCalledWith(2026, 7);
    expect(res).toBeDefined();
  });

  it('delegates getMonthlyReceivablesBreakdown to monthlyReceivablesBreakdownService', async () => {
    const res = await service.getMonthlyReceivablesBreakdown('2026-10', 'BR01');
    expect(
      mockMonthlyBreakdownService.getMonthlyReceivablesBreakdown,
    ).toHaveBeenCalledWith('2026-10', 'BR01');
    expect(res).toEqual({ month: '2026-10' });
  });

  it('getPnlTrend: lấy 12 tháng kết thúc ở tháng chọn và kẹp count 1..24', async () => {
    const result = await service.getPnlTrend(2026, 7, 99);
    expect(mockPeriodQueries.loadPnlMonthly).toHaveBeenCalledWith(
      { year: 2026, month: 7 },
      24,
    );
    expect(result[0].label).toBe('2026-thg 10');
    expect(result[0].grossMarginRatio).toBeCloseTo(0.4);
  });
});
