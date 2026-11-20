import { GarageCheckpointService } from '../garage-checkpoint.service';

function createMockQueryBuilder() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  return qb;
}

describe('GarageCheckpointService - getCheckpointCases summary đếm XE', () => {
  let service: GarageCheckpointService;
  let qb: any;

  beforeEach(() => {
    qb = createMockQueryBuilder();
    service = new GarageCheckpointService({
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    } as any);
  });

  it('summary.totalCount và funnelCounts là số xe; totalCases là số phiếu', async () => {
    qb.getRawOne.mockResolvedValue({
      totalCount: '5',
      totalCases: '7',
      totalTienCoThue: '1000',
      totalRevenue: '900',
      totalCost: '400',
      totalProfit: '500',
      totalPaid: '600',
      totalRemaining: '400',
      paidCount: '2',
      remainingCount: '3',
      unpaidCount: '1',
      quotationCount: '1',
      inProgressCount: '2',
      completedCount: '3',
      cancelledCount: '0',
    });
    qb.getRawMany.mockResolvedValue([
      {
        classificationKey: 'SUA_CHUA_CHUNG',
        count: '3',
        amount: '0',
        paid: '0',
        remaining: '0',
      },
      {
        classificationKey: 'KHAC',
        count: '2',
        amount: '0',
        paid: '0',
        remaining: '0',
      },
    ]);
    qb.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await service.getCheckpointCases('2026-11-01', '2026-11-30');

    expect(result.summary.totalCount).toBe(5);
    expect(result.summary.totalCases).toBe(7);
    expect(result.summary.funnelCounts).toEqual({
      total: 5,
      quotation: 1,
      inProgress: 2,
      completed: 3,
      cancelled: 0,
    });
    expect(result.summary.paidCount).toBe(2);
    expect(result.summary.remainingCount).toBe(3);
    expect(result.summary.unpaidCount).toBe(1);
    expect(result.classificationSummary.SUA_CHUA_CHUNG.count).toBe(3);
    expect(result.classificationSummary.KHAC.count).toBe(2);
  });

  it('các biểu thức đếm trong summary dùng khóa biển số chuẩn hóa (COUNT DISTINCT)', async () => {
    qb.getRawOne.mockResolvedValue({});
    qb.getRawMany.mockResolvedValue([]);
    qb.getManyAndCount.mockResolvedValue([[], 0]);

    await service.getCheckpointCases('2026-11-01', '2026-11-30');

    const selects: string[] = qb.select.mock.calls
      .concat(qb.addSelect.mock.calls)
      .map((c: any[]) => String(c[0]));
    const allCalls: any[][] = qb.select.mock.calls.concat(
      qb.addSelect.mock.calls,
    );
    const aliases = allCalls.map((c) => c[1]);
    expect(aliases).toEqual(
      expect.arrayContaining(['totalCount', 'totalCases']),
    );

    const vehicleSelects = selects.filter((s) => s.includes('COUNT(DISTINCT'));
    expect(vehicleSelects.length).toBeGreaterThanOrEqual(8);
    for (const s of vehicleSelects) {
      if (s === 'COUNT(DISTINCT c.id)') continue;
      expect(s).toContain(
        "REGEXP_REPLACE(UPPER(c.bien_so_xe), '[^A-Z0-9]', '', 'g')",
      );
    }
    expect(selects).toContain('COUNT(DISTINCT c.id)');
    expect(selects.some((s) => s.includes('COUNT(CASE WHEN'))).toBe(false);
  });
});
