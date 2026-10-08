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
});
