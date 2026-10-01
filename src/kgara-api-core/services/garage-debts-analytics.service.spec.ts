import { GarageDebtsAnalyticsService } from './garage-debts-analytics.service';

describe('GarageDebtsAnalyticsService', () => {
  let service: GarageDebtsAnalyticsService;
  let mockCaseRepo: any;
  let mockPayableRepo: any;
  let mockSettlementRepo: any;

  beforeEach(() => {
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
      manager: {
        query: jest.fn(),
      },
    };

    service = new GarageDebtsAnalyticsService(
      mockCaseRepo,
      mockPayableRepo,
      mockSettlementRepo,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return aggregated debts analytics correctly', async () => {
    // 1. Case aggregates
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
      // 2. Monthly trend
      .mockResolvedValueOnce([
        { month: '2026-07', cashIn: '30000000', cashOut: '15000000' },
        { month: '2026-08', cashIn: '30000000', cashOut: '20000000' },
      ])
      // 3. Top customers
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
      ]);

    // Payables query
    mockPayableRepo.manager.query
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
      // Top suppliers
      .mockResolvedValueOnce([
        {
          partnerCode: 'NCC-01',
          partnerName: 'NCC Phụ Tùng',
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
    expect(res.summary.netBalance).toBe(20000000);
    expect(res.summary.collectionRate).toBe(60);
    expect(res.agingComparison).toHaveLength(4);
    expect(res.timeHorizons.nextMonthDue.receivable).toBe(20000000);
    expect(res.forecastHorizons).toBeDefined();
    expect(res.topReceivableCustomers).toHaveLength(1);
    expect(res.topPayableSuppliers).toHaveLength(1);
  });

  it('should return time horizon cases correctly for drawer', async () => {
    // 1. Count query
    mockCaseRepo.manager.query
      .mockResolvedValueOnce([{ total: 1 }])
      // 2. Data rows query
      .mockResolvedValueOnce([
        {
          id: 'case-uuid-1',
          caseId: 'HD-001',
          soChungTu: 'PDV-2026-001',
          bienSoXe: '51A-12345',
          customerCode: 'KH-001',
          customerName: 'Anh Nam',
          totalAmount: '10000000',
          paidAmount: '0',
          balanceAmount: '10000000',
          completionDate: '2026-07-20T10:00:00',
          agingDays: 15,
          branchExternalId: 'BR-01',
          status: 'Hoàn tất',
          description: 'Sửa chữa chung',
        },
      ])
      // 3. Summary query
      .mockResolvedValueOnce([
        {
          totalAmount: '10000000',
          paidAmount: '0',
          balanceAmount: '10000000',
          count: 1,
        },
      ])
      // 4. Top partners query
      .mockResolvedValueOnce([
        {
          partnerCode: 'KH-001',
          partnerName: 'Anh Nam',
          balanceAmount: '10000000',
          caseCount: 1,
        },
      ]);

    const res = await service.getTimeHorizonCases('nextMonthDue', {
      page: 1,
      pageSize: 20,
    });

    expect(res).toBeDefined();
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].customerName).toBe('Anh Nam');
    expect(res.summary.receivableAmount).toBe(10000000);
    expect(res.summary.topPartners).toHaveLength(1);
  });
});
