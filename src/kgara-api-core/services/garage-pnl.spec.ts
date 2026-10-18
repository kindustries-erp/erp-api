import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageDashboardService } from '../garage-dashboard.service';
import { GaragePnlService } from './garage-pnl.service';
import { GarageDashboardStatsService } from './garage-dashboard-stats.service';
import { GarageCheckpointService } from './garage-checkpoint.service';
import { GarageCustomerStatsService } from './garage-customer-stats.service';
import { GarageMonthlyReceivablesBreakdownService } from './garage-monthly-receivables-breakdown.service';
import { GaragePeriodReportQueries } from './garage-period-report-queries.service';
import { GarageOpexService } from './garage-opex.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';
import { KgaraCashflowVoucher } from '../entities/kgara_cashflow_voucher.entity';

describe('GarageDashboardService & GaragePnlService - PnL Commission Calculation', () => {
  let service: GarageDashboardService;
  let pnlService: GaragePnlService;
  let mockCaseRepo: any;
  let mockOpexService: any;
  let mockOpexRepo: any;
  let mockVoucherRepo: any;

  beforeEach(async () => {
    mockCaseRepo = {
      createQueryBuilder: jest.fn(),
    };

    mockOpexService = {
      getSummaryByPeriod: jest.fn(),
    };

    mockOpexRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => ({ ...dto, id: 'mock-opex-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    mockVoucherRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => ({ ...dto, id: 'mock-voucher-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageDashboardService,
        GaragePnlService,
        {
          provide: GarageDashboardStatsService,
          useValue: {},
        },
        {
          provide: GarageCheckpointService,
          useValue: {},
        },
        {
          provide: GarageCustomerStatsService,
          useValue: {},
        },
        {
          provide: GarageMonthlyReceivablesBreakdownService,
          useValue: {},
        },
        { provide: GaragePeriodReportQueries, useValue: {} },
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: GarageOpexService,
          useValue: mockOpexService,
        },
        {
          provide: getRepositoryToken(KgaraOperatingExpense),
          useValue: mockOpexRepo,
        },
        {
          provide: getRepositoryToken(KgaraCashflowVoucher),
          useValue: mockVoucherRepo,
        },
      ],
    }).compile();

    service = module.get<GarageDashboardService>(GarageDashboardService);
    pnlService = module.get<GaragePnlService>(GaragePnlService);
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
      selling: { total: 0, ojTotal: 0, items: [] },
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
            categoryKey: 'DIEN_NUOC',
            categoryName: 'Điện nước',
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
    expect(report.sellingExpenses.total).toBe(0);
    expect(report.opex.total).toBe(146500000);
    expect(report.netProfit).toBe(56210586);
    expect(report.netProfitBeforeCommission).toBe(56210586);

    // Auto commission breakdown
    expect(report.commission.auto.kyGuiProfitRate).toBe(0);
    expect(report.commission.auto.saleCommission).toBe(0);
    expect(report.commission.auto.dvCommission).toBe(5621059);
    expect(report.serviceCommission.dvCommission).toBe(5621059);
    expect(report.commission.total).toBe(5621059);

    // Doanh thu theo phân loại: tổng 4 nhóm luôn bằng doanh thu
    const segments = report.revenueByClassification;
    expect(segments.map((x: any) => x.key)).toEqual([
      'KY_GUI',
      'SUA_CHUA_CHUNG',
      'OJ',
      'KHAC',
    ]);
    expect(segments.reduce((sum: number, x: any) => sum + x.revenue, 0)).toBe(
      444218804,
    );
    expect(segments.reduce((sum: number, x: any) => sum + x.caseCount, 0)).toBe(
      15,
    );
    expect(segments.find((x: any) => x.key === 'KHAC')).toMatchObject({
      caseCount: 0,
      revenue: 0,
      cogs: 0,
    });
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
      selling: { total: 0, ojTotal: 0, items: [] },
      opex: { total: 50000000, ojTotal: 0, items: [] },
      commission: { total: 0, ojTotal: 0, items: [] },
    });

    const report = await service.getPnlReport(2026, 8);

    expect(report.grossProfit).toBe(100000000);
    expect(report.kyGui.grossProfit).toBe(40000000);
    expect(report.kyGui.grossProfitRatio).toBe(40); // 40%

    // Selling Expenses = 50M * 40% * 10% = 2.000.000
    expect(report.sellingExpenses.total).toBe(2000000);
    expect(report.opex.total).toBe(50000000);

    // Lợi nhuận ròng = 100M (GP) - 2M (Selling) - 50M (OPEX) = 48.000.000
    expect(report.netProfit).toBe(48000000);

    // DV HH = 48M * 10% = 4.800.000
    expect(report.commission.auto.saleCommission).toBe(2000000);
    expect(report.commission.auto.dvCommission).toBe(4800000);
    expect(report.serviceCommission.dvCommission).toBe(4800000);
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
      selling: { total: 0, ojTotal: 0, items: [] },
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
      selling: { total: 0, ojTotal: 0, items: [] },
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

    // Mock DB having HOA_HONG_KHAC = -500,000 (giảm trừ)
    mockOpexService.getSummaryByPeriod.mockResolvedValue({
      directCost: { total: 0, ojTotal: 0, items: [] },
      selling: { total: 0, ojTotal: 0, items: [] },
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
      selling: { total: 0, ojTotal: 0, items: [] },
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

  describe('syncCommissionVouchers()', () => {
    const mockPnlReport = {
      commission: {
        auto: {
          saleCommission: 5000000,
          dvCommission: 8000000,
          kyGuiProfitRate: 25.5,
        },
      },
    };

    it('Scenario 1: Tạo mới 2 phiếu PENDING và 2 bản ghi OPEX khi chưa có phiếu nào', async () => {
      mockVoucherRepo.find.mockResolvedValue([]);
      mockOpexRepo.findOne.mockResolvedValue(null);

      const result = await pnlService.syncCommissionVouchers(
        2026,
        10,
        mockPnlReport,
      );

      expect(result.createdVouchers).toBe(2);
      expect(result.updatedVouchers).toBe(0);
      expect(result.deltaVouchers).toBe(0);
      expect(result.syncedOpex).toBe(2);
      expect(mockVoucherRepo.save).toHaveBeenCalledTimes(2);
      expect(mockOpexRepo.save).toHaveBeenCalledTimes(2);
      expect(mockVoucherRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transDate: '2026-11-10',
          paymentStatus: 'PENDING',
        }),
      );
    });

    it('Scenario 2: Cập nhật số tiền phiếu PENDING khi chưa chi và P&L thay đổi', async () => {
      const pendingSale: any = {
        id: 'v-sale',
        amount: 4000000,
        transDate: '2026-10-01',
        paymentStatus: 'PENDING',
        isAutoCommission: true,
        pnlCommissionType: 'HOA_HONG_SALE',
      };
      const pendingDv: any = {
        id: 'v-dv',
        amount: 7000000,
        transDate: '2026-10-01',
        paymentStatus: 'PENDING',
        isAutoCommission: true,
        pnlCommissionType: 'HOA_HONG_DV',
      };
      mockVoucherRepo.find.mockImplementation(({ where }) => {
        if (where.pnlCommissionType === 'HOA_HONG_SALE')
          return Promise.resolve([pendingSale]);
        if (where.pnlCommissionType === 'HOA_HONG_DV')
          return Promise.resolve([pendingDv]);
        return Promise.resolve([]);
      });

      const result = await pnlService.syncCommissionVouchers(
        2026,
        10,
        mockPnlReport,
      );

      expect(result.updatedVouchers).toBe(2);
      expect(pendingSale.amount).toBe(5000000);
      expect(pendingSale.transDate).toBe('2026-11-10');
      expect(pendingDv.amount).toBe(8000000);
      expect(pendingDv.transDate).toBe('2026-11-10');
    });

    it('Scenario 3: Khi đã có phiếu PAID và P&L tăng -> Giữ nguyên phiếu PAID, tạo phiếu delta PENDING mới', async () => {
      const paidVoucher = {
        id: 'paid-1',
        voucherCode: 'PC-GARA-001',
        amount: 3000000,
        paymentStatus: 'PAID',
        isAutoCommission: true,
        pnlCommissionType: 'HOA_HONG_SALE',
      };
      mockVoucherRepo.find.mockImplementation(({ where }) => {
        if (where.pnlCommissionType === 'HOA_HONG_SALE') {
          return Promise.resolve([paidVoucher]);
        }
        return Promise.resolve([]);
      });

      const result = await pnlService.syncCommissionVouchers(
        2026,
        10,
        mockPnlReport,
      );

      // Sale có 1 delta voucher mới (5M - 3M = 2M); DV tạo 1 voucher mới (8M)
      expect(result.deltaVouchers).toBe(1);
      expect(paidVoucher.amount).toBe(3000000); // KHÔNG sửa số tiền của phiếu đã chi!
      expect(mockVoucherRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2000000,
          transDate: '2026-11-10',
          paymentStatus: 'PENDING',
          pnlCommissionAnchorId: 'paid-1',
          isAutoCommission: true,
        }),
      );
    });

    it('Scenario 4: Khi đã có phiếu PAID và số tiền P&L khớp đúng số đã chi -> Không tạo thêm delta', async () => {
      const paidSale = {
        id: 'paid-sale',
        voucherCode: 'PC-GARA-SALE',
        amount: 5000000,
        paymentStatus: 'PAID',
        isAutoCommission: true,
        pnlCommissionType: 'HOA_HONG_SALE',
      };
      const paidDv = {
        id: 'paid-dv',
        voucherCode: 'PC-GARA-DV',
        amount: 8000000,
        paymentStatus: 'PAID',
        isAutoCommission: true,
        pnlCommissionType: 'HOA_HONG_DV',
      };
      mockVoucherRepo.find.mockImplementation(({ where }) => {
        if (where.pnlCommissionType === 'HOA_HONG_SALE')
          return Promise.resolve([paidSale]);
        if (where.pnlCommissionType === 'HOA_HONG_DV')
          return Promise.resolve([paidDv]);
        return Promise.resolve([]);
      });

      const result = await pnlService.syncCommissionVouchers(
        2026,
        10,
        mockPnlReport,
      );

      expect(result.deltaVouchers).toBe(0);
      expect(result.createdVouchers).toBe(0);
      expect(result.updatedVouchers).toBe(0);
    });
  });
});
