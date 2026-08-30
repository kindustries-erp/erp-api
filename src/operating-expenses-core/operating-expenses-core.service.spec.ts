import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { NotFoundException } from '@nestjs/common';

describe('OperatingExpensesCoreService', () => {
  let service: OperatingExpensesCoreService;
  let repo: jest.Mocked<Repository<ErpOperatingExpense>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockQueryBuilder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue({ totalAmountSum: '15000000' }),
    getRawMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    mockQueryBuilder.clone.mockReturnValue(mockQueryBuilder);

    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) =>
        cb({
          getRepository: () => mockRepo,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatingExpensesCoreService,
        {
          provide: getRepositoryToken(ErpOperatingExpense),
          useValue: mockRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<OperatingExpensesCoreService>(
      OperatingExpensesCoreService,
    );
    repo = module.get(getRepositoryToken(ErpOperatingExpense));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated items and summary total amount', async () => {
      const mockExpenses = [
        {
          id: '1',
          expenseNo: 'EXP-202608-001',
          title: 'Tiền thuê nhà xưởng',
          totalAmount: 15000000,
        },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockExpenses, 1]);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        totalAmountSum: '15000000',
      });

      const result = await service.findAll({
        page: 1,
        pageSize: 20,
        search: 'thuê',
        column_search: JSON.stringify({ title: 'thuê' }),
        column_filters: JSON.stringify({
          expense_category: ['Chi phí mặt bằng'],
        }),
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        sorts: ['-documentDate'],
      });

      expect(result.data).toEqual(mockExpenses);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.meta.totalAmountSum).toBe(15000000);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'exp.isDeleted = false',
      );
    });

    it('should handle empty or blank filters gracefully', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ totalAmountSum: null });

      const result = await service.findAll({
        column_filters: JSON.stringify({
          notes: ['__BLANK__'],
        }),
      });

      expect(result.data).toEqual([]);
      expect(result.meta.totalAmountSum).toBe(0);
    });
  });

  describe('getColumnOptions', () => {
    it('should return empty list for invalid column', async () => {
      const result = await service.getColumnOptions('non_existent_column');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should query distinct options for a valid column', async () => {
      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([
          { value: 'Chi phí mặt bằng' },
          { value: 'Lương' },
        ]) // total query
        .mockResolvedValueOnce([
          { value: 'Chi phí mặt bằng' },
          { value: 'Lương' },
        ]); // items query

      const result = await service.getColumnOptions(
        'expense_category',
        'Chi',
        1,
        20,
        JSON.stringify({ status: ['CONFIRMED'] }),
      );

      expect(result.items).toEqual(['Chi phí mặt bằng', 'Lương']);
      expect(result.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return expense when found', async () => {
      const mockExpense = { id: 'uuid-1', expenseNo: 'EXP-001' };
      repo.findOne.mockResolvedValue(mockExpense as any);

      const res = await service.findOne('uuid-1');
      expect(res.data).toEqual(mockExpense);
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update fields and save', async () => {
      const existing = {
        id: 'uuid-1',
        title: 'Old Title',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(existing as any);
      repo.save.mockResolvedValue({ ...existing, title: 'New Title' } as any);

      const res = await service.update('uuid-1', { title: 'New Title' });
      expect(res.message).toBe('Cập nhật khoản chi thành công');
      expect(res.data.title).toBe('New Title');
    });
  });

  describe('softDelete', () => {
    it('should set isDeleted to true', async () => {
      const existing = { id: 'uuid-1', isDeleted: false };
      repo.findOne.mockResolvedValue(existing as any);
      repo.save.mockResolvedValue({ ...existing, isDeleted: true } as any);

      const res = await service.softDelete('uuid-1');
      expect(res.message).toBe('Xóa khoản chi thành công');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });
});
