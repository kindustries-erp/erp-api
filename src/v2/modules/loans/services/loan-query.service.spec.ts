import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { applyListSummaries } from '@/common/utils/table-query';
import { LoanQueryService } from './loan-query.service';
import { LoanEntity } from '../entities';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

jest.mock('@/common/utils/table-query', () => {
  const actual = jest.requireActual('@/common/utils/table-query');
  return { ...actual, applyListSummaries: jest.fn() };
});

describe('LoanQueryService', () => {
  let service: LoanQueryService;
  let repo: any;
  let qb: any;

  beforeEach(async () => {
    (applyListSummaries as jest.Mock).mockReset();
    (applyListSummaries as jest.Mock).mockResolvedValue({});

    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      select: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '1' }),
      getRawMany: jest.fn().mockResolvedValue([{ value: 'VCB' }]),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'l1',
            loanCode: 'LOAN-01',
            title: 'Vay vốn lưu động',
            lenderName: 'VCB',
            principalAmount: '100000000',
            status: LoanStatus.ACTIVE,
          },
        ],
        1,
      ]),
    };
    qb.clone.mockReturnValue(qb);

    repo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoanQueryService,
        {
          provide: getRepositoryToken(LoanEntity),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<LoanQueryService>(LoanQueryService);
  });

  it('findAll hỗ trợ search, status, lenderName và trả rows + total + summaries', async () => {
    const res = await service.findAll({
      page: 1,
      pageSize: 20,
      search: 'VCB',
      status: LoanStatus.ACTIVE,
      lenderName: 'Vietcombank',
    });

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('loan');
    expect(qb.where).toHaveBeenCalledWith('loan.isDeleted = :deleted', {
      deleted: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :status', {
      status: LoanStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'loan.lenderName ILIKE :lenderName',
      {
        lenderName: '%Vietcombank%',
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(Brackets));
    expect(res.total).toBe(1);
    expect(res.rows[0].loanCode).toBe('LOAN-01');
  });

  it('findAll lọc deleted=only chỉ trả khoản vay đã xóa mềm', async () => {
    await service.findAll({ page: 1, pageSize: 20, deleted: 'only' });

    expect(qb.where).toHaveBeenCalledWith('loan.isDeleted = :deleted', {
      deleted: true,
    });
  });

  it('findAll gọi applyListSummaries trước khi skip/take và gắn tieBreaker loan.id', async () => {
    const metric = {
      total: 500000000,
      pageSubtotal: 100000000,
      cumulative: 200000000,
    };
    (applyListSummaries as jest.Mock).mockResolvedValueOnce({
      principalAmount: metric,
    });

    const res = await service.findAll({
      page: 2,
      pageSize: 20,
      summary_keys: 'principalAmount,unknownKey',
      sort: '-principalAmount',
    });

    expect(qb.orderBy).toHaveBeenCalledWith('loan.principalAmount', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('loan.id', 'ASC');
    expect(res.summaries).toEqual({ principalAmount: metric });
    expect(applyListSummaries).toHaveBeenCalledWith(
      qb,
      expect.objectContaining({
        keys: ['principalAmount', 'unknownKey'],
        page: 2,
        pageSize: 20,
        tieBreaker: 'loan.id',
      }),
    );
    const summaryOrder = (applyListSummaries as jest.Mock).mock
      .invocationCallOrder[0];
    const skipOrder = qb.skip.mock.invocationCallOrder[0];
    expect(summaryOrder).toBeLessThan(skipOrder);
  });

  it('findAll áp dụng column_filters dạng JSON từ V2StandardTable', async () => {
    await service.findAll({
      column_filters: JSON.stringify({ status: ['ACTIVE', 'OVERDUE'] }),
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('loan.status IN'),
      expect.any(Object),
    );
  });

  it('findColumnOptions trả rỗng khi cột không nằm trong whitelist', async () => {
    const res = await service.findColumnOptions(
      'unknownColumn',
      undefined,
      1,
      20,
      undefined,
    );

    expect(res).toEqual({ items: [], total: 0, next: null });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('findColumnOptions áp dụng deleted=only và trả danh sách options', async () => {
    const res = await service.findColumnOptions(
      'lenderName',
      '',
      1,
      20,
      undefined,
      'only',
    );

    expect(qb.where).toHaveBeenCalledWith('loan.isDeleted = :deleted', {
      deleted: true,
    });
    expect(res.items).toEqual([{ label: 'VCB', value: 'VCB' }]);
  });

  it('should throw NotFoundException if loan not found in findOne', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should findOne and return DTO with schedule', async () => {
    const mockLoan = {
      id: 'mock-id',
      loanCode: 'LOAN-01',
      title: 'Car Loan',
      lenderName: 'Bank A',
      principalAmount: '120000000',
      annualInterestRate: '12',
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
      totalPaidPrincipal: '0',
      totalPaidInterest: '0',
      remainingPrincipal: '120000000',
      status: LoanStatus.ACTIVE,
      payments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    repo.findOne.mockResolvedValue(mockLoan);

    const res = await service.findOne('mock-id');
    expect(res.id).toBe('mock-id');
    expect(res.schedule?.length).toBe(12);
  });

  it('should aggregate cashflow projection with constituent loan breakdown', async () => {
    const mockLoan = {
      id: 'l1',
      loanCode: 'LN-001',
      title: 'Vay dự án A',
      principalAmount: '24000000',
      annualInterestRate: '12',
      tenorMonths: 2,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
      status: LoanStatus.ACTIVE,
    };

    repo.find.mockResolvedValue([mockLoan]);

    const res = await service.getCashflowProjection();
    expect(res.monthlyProjections.length).toBe(2);
    expect(res.totalPrincipalDue).toBe(24000000);
    expect(res.monthlyProjections[0].breakdown).toHaveLength(1);
    expect(res.monthlyProjections[0].breakdown?.[0]).toMatchObject({
      loanId: 'l1',
      loanName: 'Vay dự án A',
      principalDue: 12000000,
    });
  });
});
