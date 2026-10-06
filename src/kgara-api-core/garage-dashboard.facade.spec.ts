import { Test, TestingModule } from '@nestjs/testing';
import { GarageDashboardService } from './garage-dashboard.service';
import { GarageDashboardStatsService } from './services/garage-dashboard-stats.service';
import { GarageCheckpointService } from './services/garage-checkpoint.service';
import { GarageCustomerStatsService } from './services/garage-customer-stats.service';
import { GarageDashboardExportService } from './services/garage-dashboard-export.service';
import { GaragePnlService } from './services/garage-pnl.service';

describe('GarageDashboardService (Facade)', () => {
  let service: GarageDashboardService;
  let mockStatsService: any;
  let mockCheckpointService: any;
  let mockCustomerStatsService: any;
  let mockExportService: any;
  let mockPnlService: any;

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

    mockExportService = {
      exportExcel: jest.fn().mockResolvedValue(Buffer.from('excel')),
    };

    mockPnlService = {
      getPnlReport: jest.fn().mockResolvedValue({ grossProfit: 100 }),
      getCombinedOpexList: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getVirtualOpexById: jest.fn().mockResolvedValue({ id: 'test' }),
      exportPnlExcel: jest.fn().mockResolvedValue(Buffer.from('pnl-excel')),
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
        {
          provide: GarageDashboardExportService,
          useValue: mockExportService,
        },
        { provide: GaragePnlService, useValue: mockPnlService },
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

  it('delegates exportExcel to exportService', async () => {
    const res = await service.exportExcel('2026-01-01', '2026-01-31');
    expect(mockExportService.exportExcel).toHaveBeenCalledWith(
      '2026-01-01',
      '2026-01-31',
    );
    expect(res).toBeDefined();
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
});
