import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OperatingExpensesCoreService } from './operating-expenses-core.service';
import { ErpOperatingExpense } from './entities/erp_operating_expense.entity';
import { SmartAccountMappingService } from './services/smart-account-mapping.service';
import { AccountingCoreService } from '../accounting-core/services/accounting-core.service';
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
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
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
      save: jest
        .fn()
        .mockImplementation((payload) =>
          Promise.resolve({ id: 'uuid-1', ...payload }),
        ),
      create: jest
        .fn()
        .mockImplementation((payload) => ({ id: 'new-uuid', ...payload })),
      find: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) =>
        cb({
          getRepository: () => mockRepo,
        }),
      ),
      manager: {
        getRepository: () => mockRepo,
      },
    };

    const mockSmartAccountMappingService = {
      resolveExpenseAccounts: jest.fn().mockResolvedValue({
        debitAccountId: 'acc-6422',
        debitAccountCode: '6422',
        creditAccountId: 'acc-335',
        creditAccountCode: '335',
        vatAccountId: 'acc-1331',
        vatAccountCode: '1331',
      }),
      findAccountByCode: jest
        .fn()
        .mockResolvedValue({ id: 'acc-t0003', accountCode: 'T0003' }),
    };

    const mockAccountingCoreService = {
      createJournalEntry: jest
        .fn()
        .mockResolvedValue({ id: 'je-1', entryNo: 'PKT-01' }),
      deleteJournalEntryBySource: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: SmartAccountMappingService,
          useValue: mockSmartAccountMappingService,
        },
        {
          provide: AccountingCoreService,
          useValue: mockAccountingCoreService,
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
          title: 'Tiền thuê văn phòng',
          totalAmount: 15000000,
          periodYear: 2026,
          periodMonth: 8,
          costGroup: 'OPEX',
        },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockExpenses, 1]);
      mockQueryBuilder.getRawOne.mockResolvedValue({
        totalAmountSum: '15000000',
      });

      const result = await service.findAll({
        page: 1,
        pageSize: 20,
        cost_group: 'OPEX',
        search: 'thuê',
        column_search: JSON.stringify({ title: 'thuê' }),
        column_filters: JSON.stringify({
          period: ['08/2026'],
        }),
        date_from: '2026-08-01',
        date_to: '2026-08-31',
        sorts: ['-period'],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].period).toBe('08/2026');
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
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { value: 'Chi phí văn phòng' },
        { value: 'Lương' },
      ]);

      const result = await service.getColumnOptions(
        'expense_category',
        'Chi',
        1,
        20,
        JSON.stringify({ status: ['CONFIRMED'] }),
      );

      expect(result.items).toEqual(['Chi phí văn phòng', 'Lương']);
      expect(result.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('should return expense when found', async () => {
      const mockExpense = {
        id: 'uuid-1',
        expenseNo: 'EXP-001',
        periodYear: 2026,
        periodMonth: 8,
        totalAmount: 5000000,
      };
      repo.findOne.mockResolvedValue(mockExpense as any);

      const res = await service.findOne('uuid-1');
      expect(res.data.id).toBe('uuid-1');
      expect(res.data.period).toBe('08/2026');
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create new expense and format period', async () => {
      const res = await service.create({
        title: 'Tiền mạng Internet',
        totalAmount: 1000000,
        periodYear: 2026,
        periodMonth: 8,
        costGroup: 'OPEX',
        categoryKey: 'DIEN_NUOC_NET',
      });

      expect(res.message).toBe('Tạo khoản chi thành công');
      expect(res.data.period).toBe('08/2026');
      expect(res.data.totalAmount).toBe(1000000);
    });
  });

  describe('applyRecurring', () => {
    it('should update this record when scope is this', async () => {
      const existing = {
        id: 'uuid-1',
        title: 'Tiền thuê VP',
        totalAmount: 10000000,
        periodYear: 2026,
        periodMonth: 8,
        recurrenceType: 'MONTHLY',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(existing as any);

      const res = await service.applyRecurring('uuid-1', {
        applyScope: 'this',
        amount: 12000000,
        title: 'Tiền thuê VP tăng giá',
      });

      expect(res.updated).toBe(1);
      expect(res.item.totalAmount).toBe(12000000);
    });
  });

  describe('softDelete', () => {
    it('should set isDeleted to true for single delete', async () => {
      const existing = { id: 'uuid-1', isDeleted: false };
      repo.findOne.mockResolvedValue(existing as any);

      const res = await service.softDelete('uuid-1');
      expect(res.message).toBe('Xóa khoản chi thành công');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true }),
      );
    });
  });

  describe('postExpense and unpostExpense', () => {
    it('posts expense and updates postingStatus to POSTED', async () => {
      const expense = {
        id: 'exp-1',
        expenseNo: 'EXP-202609-001',
        branchId: 'branch-1',
        totalAmount: 10000000,
        categoryKey: 'THUE_MAT_BANG',
        accrualMode: 'ACCRUED',
        postingStatus: 'UNPOSTED',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      const result = await service.postExpense('exp-1');

      expect(result.message).toBe('Hạch toán ghi sổ thành công');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          postingStatus: 'POSTED',
          journalEntryId: 'je-1',
        }),
      );
    });

    it('throws BadRequestException if expense is already POSTED', async () => {
      const expense = {
        id: 'exp-1',
        postingStatus: 'POSTED',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      await expect(service.postExpense('exp-1')).rejects.toThrow(
        'Khoản chi này đã được ghi sổ rồi.',
      );
    });

    it('unposts expense and updates postingStatus to UNPOSTED', async () => {
      const expense = {
        id: 'exp-1',
        postingStatus: 'POSTED',
        accrualMode: 'NONE',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      const result = await service.unpostExpense('exp-1');

      expect(result.message).toBe('Đã hủy ghi sổ khoản chi thành công');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          postingStatus: 'UNPOSTED',
          journalEntryId: null,
        }),
      );
    });
  });

  describe('settleExpenseWithInvoice and unsettleExpense', () => {
    it('throws if expense is already SETTLED (anti-double guard)', async () => {
      const expense = {
        id: 'exp-settled',
        accrualMode: 'SETTLED',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      await expect(
        service.settleExpenseWithInvoice('exp-settled', { invoiceId: 'inv-1' }),
      ).rejects.toThrow('Khoản chi phí này đã được tất toán rồi.');
    });

    it('throws if expense was not ACCRUED', async () => {
      const expense = {
        id: 'exp-none',
        accrualMode: 'NONE',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      await expect(
        service.settleExpenseWithInvoice('exp-none', { invoiceId: 'inv-1' }),
      ).rejects.toThrow(
        'Chỉ có thể tất toán hóa đơn cho khoản chi phí đã trích trước (ACCRUED).',
      );
    });

    it('settles accrued expense with invoice successfully', async () => {
      const expense = {
        id: 'exp-accrued',
        expenseNo: 'EXP-202609-001',
        branchId: 'branch-1',
        totalAmount: 10000000,
        categoryKey: 'THUE_MAT_BANG',
        accrualMode: 'ACCRUED',
        postingStatus: 'POSTED',
        isDeleted: false,
      };
      repo.findOne
        .mockResolvedValueOnce(expense as any) // find expense
        .mockResolvedValueOnce(null); // find other linked

      (dataSource as any).query = jest.fn().mockResolvedValueOnce([
        {
          id: 'inv-1',
          invoice_no: '0000123',
          total_amount: 11000000,
          vat_amount: 1000000,
          direction: 'IN',
        },
      ]);

      const result = await service.settleExpenseWithInvoice('exp-accrued', {
        invoiceId: 'inv-1',
      });

      expect(result.message).toBe(
        'Đã gắn hóa đơn và tất toán trích trước thành công',
      );
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accrualMode: 'SETTLED',
          linkedInvoiceId: 'inv-1',
        }),
      );
    });

    it('unsettles expense and reverts accrualMode to ACCRUED', async () => {
      const expense = {
        id: 'exp-settled',
        accrualMode: 'SETTLED',
        linkedInvoiceId: 'inv-1',
        isDeleted: false,
      };
      repo.findOne.mockResolvedValue(expense as any);

      const result = await service.unsettleExpense('exp-settled');

      expect(result.message).toBe('Đã gỡ hóa đơn tất toán thành công');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accrualMode: 'ACCRUED',
          linkedInvoiceId: null,
          settledAt: null,
        }),
      );
    });
  });
});
