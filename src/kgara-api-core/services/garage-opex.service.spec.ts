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
      note: 'Hoa hồng dịch vụ',
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
        getManyAndCount: jest.fn().mockResolvedValue([mockOpexItems, 2]),
        getRawMany: jest.fn().mockResolvedValue([{ value: 'Nhân sự xưởng' }]),
      })),
      find: jest.fn().mockResolvedValue(mockOpexItems),
      findOne: jest.fn().mockResolvedValue(mockOpexItems[0]),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest
        .fn()
        .mockImplementation((item) =>
          Promise.resolve({ id: 'uuid-new', ...item }),
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
    expect(res.data).toHaveLength(2);
    expect(res.data[0].period).toBe('08/2026');
    expect(res.total).toBe(2);
  });

  it('should separate OPEX and Commission in getSummaryByPeriod', async () => {
    const summary = await service.getSummaryByPeriod(2026, 8);
    expect(summary.opex.total).toBe(76500000);
    expect(summary.opex.items).toHaveLength(1);
    expect(summary.commission.total).toBe(5621059);
    expect(summary.commission.items).toHaveLength(1);
  });

  it('should create new opex item', async () => {
    const dto = {
      periodYear: 2026,
      periodMonth: 8,
      categoryKey: 'THUE_MAT_BANG',
      categoryName: 'Thuê mặt bằng',
      amount: 30000000,
      note: 'Tháng 8/2026',
    };
    const created = await service.create(dto);
    expect(created.amount).toBe(30000000);
    expect(created.period).toBe('08/2026');
  });

  it('should update opex item', async () => {
    const updated = await service.update('uuid-1', { amount: 80000000 });
    expect(updated.amount).toBe(80000000);
  });

  it('should delete opex item', async () => {
    const result = await service.delete('uuid-1');
    expect(result.success).toBe(true);
  });
});
