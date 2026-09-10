import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageDashboardService } from '../garage-dashboard.service';
import { GarageOpexService } from './garage-opex.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraCaseService } from '../entities/kgara_case_service.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';

describe('GarageDashboardService - PnL Commission Calculation', () => {
  let service: GarageDashboardService;
  let mockCaseRepo: any;
  let mockOpexService: any;

  beforeEach(async () => {
    mockCaseRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockOpexService = {
      getSummaryByPeriod: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageDashboardService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseService),
          useValue: {},
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: {},
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: {},
        },
        {
          provide: GarageOpexService,
          useValue: mockOpexService,
        },
      ],
    }).compile();

    service = module.get<GarageDashboardService>(GarageDashboardService);
  });

  it('Scenario 1: Net Profit > 0 and No Consignment (Ky Gui = 0) -> Matching User Screenshot', async () => {
    // 1. Mock DB aggregate matching July 2026
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '444218804',
        cogs: '241508218',
        caseCount: '15',
        kyGuiRevenue: '0',
        kyGuiCogs: '0',
        kyGuiCaseCount: '0',
        suaChuaChungRevenue: '444218804',
        suaChuaChungCogs: '241508218',
        suaChuaChungCaseCount: '15',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    // 2. Mock OPEX Summary (OPEX = 146.500.000, DirectCost = 0, Commission = 0)
    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: {
        total: 146500000,
        ojTotal: 0,
        items: [
          { categoryKey: 'NHAN_SU', categoryName: 'Nhân sự', amount: 76500000 },
          {
            categoryKey: 'THUE_MAT_BANG',
            categoryName: 'Thuê mặt bằng & điện nước',
            amount: 30000000,
          },
          {
            categoryKey: 'VAT_TU_TIEU_HAO',
            categoryName: 'Vật tư tiêu hao',
            amount: 15000000,
          },
          { categoryKey: 'BAO_TRI', categoryName: 'Bảo trì', amount: 10000000 },
          {
            categoryKey: 'KHAU_HAO',
            categoryName: 'Khấu hao máy móc & thiết bị',
            amount: 15000000,
          },
        ],
      },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const report = await service.getPnlReport(2026, 7);

    // Assertions
    expect(report.revenue).toBe(444218804);
    expect(report.cogs).toBe(241508218);
    expect(report.grossProfit).toBe(202710586);
    expect(report.opex.total).toBe(146500000);
    expect(report.netProfitBeforeCommission).toBe(56210586);

    // Auto commission breakdown
    expect(report.commission.auto.kyGuiProfitRate).toBe(0);
    expect(report.commission.auto.saleCommission).toBe(0);
    expect(report.commission.auto.dvCommission).toBe(5621059);
    expect(report.commission.total).toBe(5621059);
    expect(report.netProfitAfterCommission).toBe(50589527);
  });

  it('Scenario 2: Net Profit > 0 with Consignment (Rate = 40%) -> Proportional Sale & DV Commission', async () => {
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '200000000',
        cogs: '100000000',
        caseCount: '10',
        kyGuiRevenue: '80000000',
        kyGuiCogs: '40000000', // Ky Gui GP = 40.000.000
        kyGuiCaseCount: '3',
        suaChuaChungRevenue: '120000000',
        suaChuaChungCogs: '60000000',
        suaChuaChungCaseCount: '7',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 50000000, ojTotal: 0, items: [] },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const report = await service.getPnlReport(2026, 8);

    expect(report.grossProfit).toBe(100000000);
    expect(report.kyGui.grossProfit).toBe(40000000);
    expect(report.kyGui.grossProfitRatio).toBe(40); // 40%

    expect(report.netProfitBeforeCommission).toBe(50000000); // 100M - 50M

    // Sale HH = 50M * 40% * 10% = 2.000.000
    expect(report.commission.auto.saleCommission).toBe(2000000);
    // DV HH = (50M - 2M) * 10% = 4.800.000
    expect(report.commission.auto.dvCommission).toBe(4800000);
    expect(report.commission.total).toBe(6800000);
    expect(report.netProfitAfterCommission).toBe(43200000);
  });

  it('Scenario 3: Net Profit <= 0 -> Commission should be 0', async () => {
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '100000000',
        cogs: '80000000',
        caseCount: '5',
        kyGuiRevenue: '50000000',
        kyGuiCogs: '40000000',
        kyGuiCaseCount: '2',
        suaChuaChungRevenue: '50000000',
        suaChuaChungCogs: '40000000',
        suaChuaChungCaseCount: '3',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    // OPEX (50M) > GP (20M) -> Net Profit = -30M
    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 50000000, ojTotal: 0, items: [] },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const report = await service.getPnlReport(2026, 9);

    expect(report.grossProfit).toBe(20000000);
    expect(report.netProfitBeforeCommission).toBe(-30000000);

    expect(report.commission.auto.saleCommission).toBe(0);
    expect(report.commission.auto.dvCommission).toBe(0);
    expect(report.commission.total).toBe(0);
    expect(report.netProfitAfterCommission).toBe(-30000000);
  });

  it('Scenario 4: exportPnlExcel generates valid buffer', async () => {
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '100000000',
        cogs: '60000000',
        caseCount: '5',
        kyGuiRevenue: '0',
        kyGuiCogs: '0',
        kyGuiCaseCount: '0',
        suaChuaChungRevenue: '100000000',
        suaChuaChungCogs: '60000000',
        suaChuaChungCaseCount: '5',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 20000000, ojTotal: 0, items: [] },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const buffer = await service.exportPnlExcel(2026, 7);
    expect(buffer).toBeDefined();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('Scenario 5: When HOA_HONG_KHAC exists with positive/negative adjustments, it correctly adjusts total commission and net profit', async () => {
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '200000000',
        cogs: '100000000',
        caseCount: '10',
        kyGuiRevenue: '80000000',
        kyGuiCogs: '40000000',
        kyGuiCaseCount: '3',
        suaChuaChungRevenue: '120000000',
        suaChuaChungCogs: '60000000',
        suaChuaChungCaseCount: '7',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    // Mock DB having HOA_HONG_KHAC = -500,000 (giảm trừ)
    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 50000000, ojTotal: 0, items: [] },
      commission: {
        total: -500000,
        ojTotal: 0,
        items: [
          {
            id: 'comm-adjust-1',
            categoryKey: 'HOA_HONG_KHAC',
            categoryName: 'Hoa hồng khác / Điều chỉnh',
            amount: -500000,
            ojAmount: 0,
            note: 'Giảm trừ hoa hồng',
          },
        ],
      },
    });

    const report = await service.getPnlReport(2026, 8);

    // Net Profit Before Comm: 100M - 50M = 50M
    // Ky Gui Profit: 40M / 100M = 40%
    // Sale Comm: 50M * 40% * 10% = 2,000,000
    // DV Comm: (50M - 2M) * 10% = 4,800,000
    // Manual Comm: -500,000
    // Total Comm: 2,000,000 + 4,800,000 - 500,000 = 6,300,000
    // Net Profit After Comm: 50M - 6.3M = 43,700,000
    expect(report.commission.auto.saleCommission).toBe(2000000);
    expect(report.commission.auto.dvCommission).toBe(4800000);
    expect(report.commission.manual.total).toBe(-500000);
    expect(report.commission.total).toBe(6300000);
    expect(report.netProfitAfterCommission).toBe(43700000);
  });

  it('Scenario 6: getCombinedOpexList automatically injects virtual HOA_HONG_SALE and HOA_HONG_DV items', async () => {
    const mockQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        revenue: '200000000',
        cogs: '100000000',
        caseCount: '10',
        kyGuiRevenue: '80000000',
        kyGuiCogs: '40000000',
        kyGuiCaseCount: '3',
        suaChuaChungRevenue: '120000000',
        suaChuaChungCogs: '60000000',
        suaChuaChungCaseCount: '7',
        ojRevenue: '0',
        ojCogs: '0',
        ojCaseCount: '0',
      }),
    };
    mockCaseRepo.createQueryBuilder.mockReturnValue(mockQb);

    mockOpexService.getList = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'real-1',
          periodYear: 2026,
          periodMonth: 8,
          categoryKey: 'NHAN_SU',
          categoryName: 'Nhân sự',
          amount: 50000000,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 50000000, ojTotal: 0, items: [] },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const res = await service.getCombinedOpexList({
      year: 2026,
      month: 8,
    } as any);

    expect(res.total).toBe(3); // 1 real + 2 virtual
    const saleItem = res.data.find(
      (i: any) => i.categoryKey === 'HOA_HONG_SALE',
    );
    const dvItem = res.data.find((i: any) => i.categoryKey === 'HOA_HONG_DV');

    expect(saleItem).toBeDefined();
    expect(saleItem.isAutoCalculated).toBe(true);
    expect(saleItem.isReadOnly).toBe(true);
    expect(saleItem.amount).toBe(2000000);

    expect(dvItem).toBeDefined();
    expect(dvItem.isAutoCalculated).toBe(true);
    expect(dvItem.isReadOnly).toBe(true);
    expect(dvItem.amount).toBe(4800000);
  });
});
