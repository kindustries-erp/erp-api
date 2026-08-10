import { TransactionAnalyticsService } from './transaction-analytics.service';

describe('TransactionAnalyticsService', () => {
  let service: TransactionAnalyticsService;
  let transactionRepo: any;

  beforeEach(() => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      andHaving: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getQueryAndParameters: jest.fn().mockReturnValue(['SELECT 1', []]),
    };

    const countQb: any = {
      orderBy: jest.fn().mockReturnThis(),
      getQueryAndParameters: jest.fn().mockReturnValue(['SELECT 1', []]),
    };

    qb.clone.mockReturnValue(countQb);

    const categoryQb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    transactionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      manager: {
        query: jest.fn().mockResolvedValue([{ cnt: '0' }]),
        createQueryBuilder: jest.fn().mockReturnValue(categoryQb),
      },
      query: jest.fn().mockResolvedValue([]),
    };

    service = new TransactionAnalyticsService(transactionRepo);
  });

  it('returns zeroed dashboard stats when no transactions', async () => {
    const result = await service.getDashboardStats({} as any);

    expect(result).toEqual({
      totalCashIn: 0,
      totalCashOut: 0,
      netCashFlow: 0,
      cashTrend: [],
      categoryBreakdown: [],
      sourceBreakdown: [],
      topTransactionsIn: [],
      topTransactionsOut: [],
    });
  });

  it('returns empty partner stats pagination when no grouped results', async () => {
    const result = await service.getPartnerStats({
      page: 1,
      pageSize: 20,
    } as any);

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });
});
