import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageDebtsAnalyticsService } from './garage-debts-analytics.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraPayable } from '../entities/kgara_payable.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';

describe('GarageDebtsAnalyticsService', () => {
  let service: GarageDebtsAnalyticsService;
  let mockCaseRepo: any;
  let mockPayableRepo: any;
  let mockSettlementRepo: any;

  beforeEach(async () => {
    mockCaseRepo = {
      manager: {
        query: jest.fn(),
      },
    };
    mockPayableRepo = {
      manager: {
        query: jest.fn(),
      },
    };
    mockSettlementRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageDebtsAnalyticsService,
        { provide: getRepositoryToken(KgaraCase), useValue: mockCaseRepo },
        {
          provide: getRepositoryToken(KgaraPayable),
          useValue: mockPayableRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
      ],
    }).compile();

    service = module.get<GarageDebtsAnalyticsService>(
      GarageDebtsAnalyticsService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return aggregated debts analytics correctly', async () => {
    // 1. Case aggregates (Receivables)
    mockCaseRepo.manager.query
      .mockResolvedValueOnce([
        {
          totalReceivable: '100000000',
          paidReceivable: '60000000',
          remainingReceivable: '40000000',
          aging0To30: '20000000',
          aging31To60: '10000000',
          aging61To90: '5000000',
          agingOver90: '5000000',
          dueNextWeek: '10000000',
        },
      ])
      // 2. Payables query (Từ chi phí sổ báo giá)
      .mockResolvedValueOnce([
        {
          totalPayable: '50000000',
          paidPayable: '30000000',
          remainingPayable: '20000000',
          aging0To30: '10000000',
          aging31To60: '5000000',
          aging61To90: '3000000',
          agingOver90: '2000000',
          dueNextWeek: '5000000',
        },
      ])
      // 3. Monthly trend
      .mockResolvedValueOnce([
        { month: '2026-07', cashIn: '30000000', cashOut: '15000000' },
        { month: '2026-08', cashIn: '30000000', cashOut: '20000000' },
      ])
      // 4. Top customers
      .mockResolvedValueOnce([
        {
          partnerCode: 'KH-01',
          partnerName: 'Khách A',
          totalAmount: '50000000',
          balanceAmount: '20000000',
          overdueAmount: '10000000',
          maxAgingDays: 45,
          caseCount: 2,
        },
      ])
      // 5. Top suppliers / top cost cases
      .mockResolvedValueOnce([
        {
          partnerCode: 'GR-PDV2608-0074',
          partnerName: 'Khách B',
          totalAmount: '30000000',
          balanceAmount: '15000000',
          overdueAmount: '5000000',
          maxAgingDays: 35,
          caseCount: 1,
        },
      ]);

    const res = await service.getDebtsAnalytics();

    expect(res).toBeDefined();
    expect(res.summary.totalReceivable).toBe(100000000);
    expect(res.summary.paidReceivable).toBe(60000000);
    expect(res.summary.remainingReceivable).toBe(40000000);
    expect(res.summary.totalPayable).toBe(50000000);
    expect(res.summary.paidPayable).toBe(30000000);
    expect(res.summary.remainingPayable).toBe(20000000);
    expect(res.summary.netBalance).toBe(20000000); // 40M - 20M

    expect(res.agingComparison).toHaveLength(4);
    expect(res.agingComparison[0].receivableAmount).toBe(20000000);
    expect(res.agingComparison[0].payableAmount).toBe(10000000);

    expect(res.timeHorizons.nextWeekDue.receivable).toBe(10000000);
    expect(res.timeHorizons.nextWeekDue.payable).toBe(5000000);

    expect(res.cashTrend).toHaveLength(2);
    expect(res.topReceivableCustomers).toHaveLength(1);
    expect(res.topPayableSuppliers).toHaveLength(1);
  });

  it('phải trả trừ cấn trừ PAYMENT: SQL có join PAYMENT, trend cashOut = đã chi, cho phép âm', async () => {
    mockCaseRepo.manager.query
      .mockResolvedValueOnce([
        { totalReceivable: '0', remainingReceivable: '0' },
      ])
      .mockResolvedValueOnce([
        {
          totalPayable: '1000000',
          paidPayable: '1200000',
          remainingPayable: '-200000',
          aging0To30: '-200000',
        },
      ])
      .mockResolvedValueOnce([
        { month: '2026-07', cashIn: '500000', cashOut: '1200000' },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const res = await service.getDebtsAnalytics();

    const calls = mockCaseRepo.manager.query.mock.calls.map(
      (c: any[]) => c[0] as string,
    );
    const [, payableSql, trendSql, , suppSql] = calls;
    for (const sql of [payableSql, trendSql, suppSql]) {
      expect(sql).toContain(`"settlement_type" = 'PAYMENT'`);
    }
    expect(payableSql).toContain('<> 0');
    expect(res.summary.paidPayable).toBe(1200000);
    expect(res.summary.remainingPayable).toBe(-200000);
    expect(res.summary.netBalance).toBe(200000);
    expect(res.summary.paymentRate).toBe(120);
    expect(res.cashTrend[0].cashOut).toBe(1200000);
    expect(res.cashTrend[0].netCash).toBe(-700000);
  });

  it('should return time horizon cases correctly for drawer', async () => {
    mockCaseRepo.manager.query
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          id: 'case-1',
          caseId: 'case-1',
          soChungTu: 'GR-001',
          customerName: 'Khách A',
          direction: 'OUT',
          totalAmount: 1000000,
          paidAmount: 500000,
          balanceAmount: 500000,
          completionDate: '2026-07-15T00:00:00',
          agingDays: 10,
        },
      ])
      .mockResolvedValueOnce([
        {
          totalAmount: 1000000,
          paidAmount: 500000,
          balanceAmount: 500000,
          count: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          partnerCode: 'KH-01',
          partnerName: 'Khách A',
          balanceAmount: 500000,
          caseCount: 1,
        },
      ]);

    const res = await service.getTimeHorizonCases('overdue30To90');

    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.summary.receivableAmount).toBe(500000);
    expect(res.summary.topPartners).toHaveLength(1);
  });

  describe('chỉ tính phiếu hoàn thành (tình trạng 3)', () => {
    const STATUS_CONDITION = '"c"."tinh_trang_dich_vu" = 3';

    it('phải thu, phải trả, trend và top đối tác đều lọc tình trạng = 3, không lấy dòng lãi gộp không có phiếu', async () => {
      mockCaseRepo.manager.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getDebtsAnalytics();

      const calls = mockCaseRepo.manager.query.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(calls).toHaveLength(5);
      for (const sql of calls) {
        expect(sql).toContain(STATUS_CONDITION);
      }
      const payableSql = calls[1];
      expect(payableSql).toContain('"c"."id" IS NOT NULL');
      expect(payableSql).not.toContain('"c"."id" IS NULL OR');
    });

    it('danh sách theo mốc thời gian cũng lọc tình trạng = 3', async () => {
      mockCaseRepo.manager.query
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([]);

      await service.getTimeHorizonCases('overdue30To90');

      const calls = mockCaseRepo.manager.query.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(calls.length).toBeGreaterThan(0);
      for (const sql of calls) {
        expect(sql).toContain(STATUS_CONDITION);
      }
    });
  });
});
