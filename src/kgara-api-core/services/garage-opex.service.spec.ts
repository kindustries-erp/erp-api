import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GarageOpexService } from './garage-opex.service';
import { KgaraOperatingExpense } from '../entities/kgara_operating_expense.entity';

describe('GarageOpexService', () => {
  let service: GarageOpexService;
  let opexRepo: any;

  const mockOpexItems = [
    {
      id: 'uuid-1',
      periodYear: 2026,
      periodMonth: 8,
      categoryKey: 'NHAN_SU',
      categoryName: 'Nhân sự xưởng',
      amount: 76500000,
      ojAmount: 10000000,
      note: 'Lương KTV',
      createdAt: new Date(),
    },
    {
      id: 'uuid-2',
      periodYear: 2026,
      periodMonth: 8,
      categoryKey: 'HOA_HONG_DV',
      categoryName: 'Hoa hồng DV (10%)',
      amount: 5621059,
      ojAmount: 1200000,
      note: 'Hoa hồng dịch vụ',
      createdAt: new Date(),
    },
    {
      id: 'uuid-3',
      periodYear: 2026,
      periodMonth: 8,
      categoryKey: 'HOA_HONG_TRUC_TIEP',
      categoryName: 'Hoa hồng trực tiếp KTV',
      amount: 2500000,
      ojAmount: 500000,
      note: 'Hoa hồng tính vào giá vốn',
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    opexRepo = {
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockOpexItems, 3]),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'Nhân sự xưởng' }]),
      })),
      find: jest.fn().mockResolvedValue(mockOpexItems),
      findOne: jest.fn().mockResolvedValue({ ...mockOpexItems[0] }),
      create: jest.fn().mockImplementation((dto) => ({ ...dto })),
      save: jest
        .fn()
        .mockImplementation((item) =>
          Promise.resolve({ id: item.id || 'uuid-new', ...item }),
        ),
      remove: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GarageOpexService,
        {
          provide: getRepositoryToken(KgaraOperatingExpense),
          useValue: opexRepo,
        },
      ],
    }).compile();

    service = module.get<GarageOpexService>(GarageOpexService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get list of opex with pagination and formatted period', async () => {
    const res = await service.getList({ year: 2026, month: 8 });
    expect(res.data).toHaveLength(3);
    expect(res.data[0].period).toBe('08/2026');
    expect(res.data[0].ojAmount).toBe(10000000);
    expect(res.total).toBe(3);
  });

  it('should separate OPEX, DirectCost and Commission in getSummaryByPeriod with oj totals', async () => {
    const summary = await service.getSummaryByPeriod(2026, 8);
    expect(summary.opex.total).toBe(76500000);
    expect(summary.opex.ojTotal).toBe(10000000);
    expect(summary.opex.items).toHaveLength(1);
    expect(summary.commission.total).toBe(5621059);
    expect(summary.commission.ojTotal).toBe(1200000);
    expect(summary.commission.items).toHaveLength(1);
    expect(summary.directCost.total).toBe(2500000);
    expect(summary.directCost.ojTotal).toBe(500000);
    expect(summary.directCost.items).toHaveLength(1);
  });

  it('should create new opex item with ojAmount', async () => {
    const dto = {
      periodYear: 2026,
      periodMonth: 8,
      categoryKey: 'THUE_MAT_BANG',
      categoryName: 'Thuê mặt bằng',
      amount: 30000000,
      ojAmount: 5000000,
      note: 'Tháng 8/2026',
    };
    const created = await service.create(dto);
    expect(created.amount).toBe(30000000);
    expect(created.ojAmount).toBe(5000000);
    expect(created.period).toBe('08/2026');
  });

  it('should update opex item with ojAmount', async () => {
    const updated = await service.update('uuid-1', {
      amount: 80000000,
      ojAmount: 12000000,
    });
    expect(updated.amount).toBe(80000000);
    expect(updated.ojAmount).toBe(12000000);
  });

  it('should apply recurring changes for this period only', async () => {
    const result = await service.applyRecurring('uuid-1', {
      applyScope: 'this',
      amount: 85000000,
      ojAmount: 15000000,
      categoryKey: 'NHAN_SU',
      categoryName: 'Nhân sự xưởng',
    });
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    expect(result.item.amount).toBe(85000000);
    expect(result.item.ojAmount).toBe(15000000);
  });

  it('should apply recurring changes for this and future periods', async () => {
    opexRepo.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where.id) {
        return Promise.resolve({ ...mockOpexItems[0] });
      }
      // Return null for future periods to simulate new records creation
      return Promise.resolve(null);
    });

    const result = await service.applyRecurring('uuid-1', {
      applyScope: 'this_and_future',
      amount: 90000000,
      ojAmount: 18000000,
      categoryKey: 'NHAN_SU',
      categoryName: 'Nhân sự xưởng',
      recurrenceType: 'monthly',
      untilYear: 2026,
      untilMonth: 10,
    });

    // August (current updated) + Sept (created) + Oct (created) = 1 updated + 2 created = 3 total
    expect(result.updated).toBe(1);
    expect(result.created).toBe(2);
    expect(result.total).toBe(3);
    expect(result.item.amount).toBe(90000000);
    expect(result.item.ojAmount).toBe(18000000);
  });

  it('should delete opex item', async () => {
    const result = await service.delete('uuid-1');
    expect(result.success).toBe(true);
  });
});
