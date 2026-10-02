import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { KgaraCaseListQueryService } from './kgara-case-list-query.service';
import { KgaraCase } from '../entities/kgara_case.entity';
import { KgaraGrossProfit } from '../entities/kgara_gross_profit.entity';
import { KgaraCaseSettlement } from '../entities/kgara_case_settlement.entity';
import { KgaraCaseLinkedInvoice } from '../entities/kgara_case_linked_invoice.entity';

describe('KgaraCaseListQueryService - Cumulative & Totals Calculation', () => {
  let service: KgaraCaseListQueryService;

  const mockTotalsRaw = {
    totalRevenue: '208517400',
    totalCost: '137189800',
    totalProfit: '71327600',
    totalReceivable: '1201871680',
    totalPaid: '0',
    totalBalance: '1201871680',
  };

  const mockQueryBuilder: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(mockTotalsRaw),
    getRawMany: jest.fn(),
    expressionMap: {
      orderBys: {},
      selects: [],
    },
  };

  mockQueryBuilder.clone.mockReturnValue(mockQueryBuilder);

  const mockCaseRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockSettlementRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockLinkedInvoiceRepo = {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockDataSource = {
    getRepository: jest.fn().mockReturnValue({
      find: jest.fn().mockResolvedValue([]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KgaraCaseListQueryService,
        {
          provide: getRepositoryToken(KgaraCase),
          useValue: mockCaseRepo,
        },
        {
          provide: getRepositoryToken(KgaraGrossProfit),
          useValue: {},
        },
        {
          provide: getRepositoryToken(KgaraCaseSettlement),
          useValue: mockSettlementRepo,
        },
        {
          provide: getRepositoryToken(KgaraCaseLinkedInvoice),
          useValue: mockLinkedInvoiceRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<KgaraCaseListQueryService>(KgaraCaseListQueryService);
    jest.clearAllMocks();
    mockQueryBuilder.clone.mockReturnValue(mockQueryBuilder);
  });

  it('Page 1: should calculate cumulative sums directly from enriched page data without including tienCoThue into revenue', async () => {
    // 2 cases: row 1 có doanhThu, row 2 chưa có doanhThu (chỉ có tienCoThue)
    const page1Data = [
      {
        id: 'case-1',
        soChungTu: 'PDV-001',
        doanhThu: 133445000,
        chiPhi: 81784900,
        loiNhuan: 51660100,
        tienCoThue: 575953840,
        tienDaThanhToan: 0,
        tienConPhaiThanhToan: 575953840,
      },
      {
        id: 'case-2',
        soChungTu: 'PDV-002',
        doanhThu: null, // Chưa có doanh thu
        chiPhi: null,
        loiNhuan: null,
        tienCoThue: 8550000, // Tiền có thuế KHÔNG được tính vào doanh thu
        tienDaThanhToan: 0,
        tienConPhaiThanhToan: 8550000,
      },
    ];

    mockQueryBuilder.getManyAndCount.mockResolvedValue([page1Data, 50]);

    const res = await service.findCases({ page: 1, pageSize: 20 });

    // cumulativeRevenue của Trang 1 chỉ là 133.445.000, không bị cộng 8.550.000 của tienCoThue
    expect(res.totals.cumulativeRevenue).toBe(133445000);
    expect(res.totals.cumulativeCost).toBe(81784900);
    expect(res.totals.cumulativeProfit).toBe(51660100);
    expect(res.totals.cumulativeReceivable).toBe(575953840 + 8550000);
  });

  it('Page 2: should query cumulative rows and correctly accumulate without fallback to tien_co_thue', async () => {
    const page2Data = [
      {
        id: 'case-3',
        soChungTu: 'PDV-003',
        doanhThu: 75072400,
        chiPhi: 55404900,
        loiNhuan: 19667500,
        tienCoThue: 76678920,
        tienDaThanhToan: 0,
        tienConPhaiThanhToan: 76678920,
      },
    ];

    mockQueryBuilder.getManyAndCount.mockResolvedValue([page2Data, 50]);

    // Giả lập cumRows trả về từ cumQb cho 2 trang (Trang 1 + Trang 2)
    mockQueryBuilder.getRawMany.mockResolvedValue([
      {
        rev: '133445000',
        cost: '81784900',
        profit: '51660100',
        receivable: '575953840',
        paid: '0',
        balance: '575953840',
      },
      {
        rev: '0',
        cost: '0',
        profit: '0',
        receivable: '8550000',
        paid: '0',
        balance: '8550000',
      }, // Case chưa hoàn thành
      {
        rev: '75072400',
        cost: '55404900',
        profit: '19667500',
        receivable: '76678920',
        paid: '0',
        balance: '76678920',
      },
    ]);

    const res = await service.findCases({ page: 2, pageSize: 20 });

    // Lũy kế T1 -> T2 = 133.445.000 + 75.072.400 = 208.517.400
    expect(res.totals.cumulativeRevenue).toBe(208517400);
    expect(res.totals.cumulativeCost).toBe(81784900 + 55404900);
    expect(res.totals.cumulativeProfit).toBe(51660100 + 19667500);
  });
});
