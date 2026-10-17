import { GarageCashflowDashboardEngine } from './garage-cashflow-dashboard.engine';

function createMockQueryBuilder() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  return qb;
}

describe('GarageCashflowDashboardEngine', () => {
  let engine: GarageCashflowDashboardEngine;
  let mockRepo: any;
  let qb: any;

  beforeEach(() => {
    qb = createMockQueryBuilder();
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    engine = new GarageCashflowDashboardEngine(mockRepo);
  });

  it('calculates KPIs correctly with net calculation', async () => {
    qb.getRawOne.mockResolvedValue({
      totalIn: '100000000',
      totalOut: '40000000',
      countIn: '25',
      countOut: '10',
      pendingOutAmount: '5000000',
      pendingOutCount: '2',
    });
    qb.getRawMany.mockResolvedValue([]);

    const result = await engine.getDashboardStats({});

    expect(result.kpi.totalIn).toBe(100000000);
    expect(result.kpi.totalOut).toBe(40000000);
    expect(result.kpi.net).toBe(60000000);
    expect(result.kpi.countIn).toBe(25);
    expect(result.kpi.countOut).toBe(10);
    expect(result.kpi.pendingOutAmount).toBe(5000000);
    expect(result.kpi.pendingOutCount).toBe(2);
  });

  it('applies date and filter conditions to query builder', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);

    await engine.getDashboardStats({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-15',
      paymentMethod: 'Tiền mặt',
      paymentContent: '1. KH thanh toán',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('v.trans_date >= :dateFrom', {
      dateFrom: '2026-10-01',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('v.trans_date <= :dateTo', {
      dateTo: '2026-10-15',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'v.payment_method = :paymentMethod',
      {
        paymentMethod: 'Tiền mặt',
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'v.payment_content = :paymentContent',
      { paymentContent: '1. KH thanh toán' },
    );
  });

  it('formats trend data with reverse order for chronological display', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockImplementation(() => {
      return Promise.resolve([
        { label: '2026-10', cashIn: '50000000', cashOut: '20000000' },
        { label: '2026-09', cashIn: '40000000', cashOut: '15000000' },
      ]);
    });

    const result = await engine.getDashboardStats({});

    expect(result.trend).toHaveLength(2);
    expect(result.trend[0].label).toBe('2026-09');
    expect(result.trend[0].cashIn).toBe(40000000);
    expect(result.trend[0].net).toBe(25000000);
    expect(result.trend[1].label).toBe('2026-10');
    expect(result.trend[1].net).toBe(30000000);
  });
});
