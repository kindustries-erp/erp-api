import { GarageCheckpointService } from '../garage-checkpoint.service';

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
    clone: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  qb.clone.mockReturnValue(qb);
  return qb;
}

describe('GarageCheckpointService - Stages & Checkpoint KPIs', () => {
  let service: GarageCheckpointService;
  let mockRepo: any;
  let qb: any;

  beforeEach(() => {
    qb = createMockQueryBuilder();
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    service = new GarageCheckpointService(mockRepo);
  });

  it('getCheckpointKpis returns reception stages, classifications, and byStage breakdown', async () => {
    // getRawOne trả về số liệu tài chính hoặc số liệu stages & classifications
    qb.getRawOne.mockImplementation(() =>
      Promise.resolve({
        revenue: '245350000',
        cost: '144615000',
        profit: '100735000',
        tienCoThue: '248942000',
        paid: '218750000',
        receivable: '30192000',
        count: '6',
        // Các trường của getPeriodStages
        totalIntake: '15',
        intakeCount: '2',
        intakeAmount: '20000000',
        quotationCount: '3',
        quotationAmount: '50000000',
        inProgressCount: '4',
        inProgressAmount: '70000000',
        completedCount: '6',
        completedAmount: '108942000',
        cancelledCount: '0',
        totalSuaChua: '1',
        totalKyGui: '2',
        totalOj: '4',
        totalKhac: '8',
        intakeSuaChua: '0',
        intakeKyGui: '0',
        intakeOj: '1',
        intakeKhac: '1',
        quotationSuaChua: '0',
        quotationKyGui: '1',
        quotationOj: '1',
        quotationKhac: '1',
        inProgressSuaChua: '0',
        inProgressKyGui: '0',
        inProgressOj: '2',
        inProgressKhac: '2',
        completedSuaChua: '1',
        completedKyGui: '1',
        completedOj: '0',
        completedKhac: '4',
      }),
    );

    // getRawMany cho pipeline
    qb.getRawMany.mockResolvedValue([
      { classificationKey: 'SUA_CHUA_CHUNG', count: '3', amount: '15000000' },
    ]);

    const result = await service.getCheckpointKpis();

    expect(result).toBeDefined();
    expect(result.month).toBeDefined();
    expect(result.week).toBeDefined();
    expect(result.day).toBeDefined();

    // Kiểm tra cấu trúc và giá trị của stages trong month
    expect(result.month.stages).toEqual({
      totalCases: 0,
      totalIntake: 15,
      intake: 2,
      intakeAmount: 20000000,
      quotation: 3,
      quotationAmount: 50000000,
      inProgress: 4,
      inProgressAmount: 70000000,
      completed: 6,
      completedAmount: 108942000,
      cancelled: 0,
      classifications: {
        suaChua: 1,
        kyGui: 2,
        oj: 4,
        khac: 8,
      },
      byStage: {
        intake: { suaChua: 0, kyGui: 0, oj: 1, khac: 1 },
        quotation: { suaChua: 0, kyGui: 1, oj: 1, khac: 1 },
        inProgress: { suaChua: 0, kyGui: 0, oj: 2, khac: 2 },
        completed: { suaChua: 1, kyGui: 1, oj: 0, khac: 4 },
      },
    });
  });
});
