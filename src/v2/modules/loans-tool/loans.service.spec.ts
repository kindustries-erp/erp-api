import { Test, TestingModule } from '@nestjs/testing';
import { LoansService } from './loans.service';
import { LoanQueryService } from './services/loan-query.service';
import { LoanCommandService } from './services/loan-command.service';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

describe('LoansService (Facade)', () => {
  let service: LoansService;
  let queryService: Partial<LoanQueryService>;
  let commandService: Partial<LoanCommandService>;

  beforeEach(async () => {
    queryService = {
      findAll: jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'l1',
            loanCode: 'LOAN-001',
            title: 'Vay vốn',
            lenderName: 'VCB',
            partnerId: null,
            principalAmount: '100000000',
            annualInterestRate: '10',
            tenorMonths: 12,
            amortizationMethod: AmortizationMethod.AMORTIZED,
            startDate: '2026-01-01',
            firstPaymentDate: '2026-02-01',
            totalPaidPrincipal: '0',
            totalPaidInterest: '0',
            remainingPrincipal: '100000000',
            status: LoanStatus.ACTIVE,
            notes: null,
            createdBy: null,
            extraData: {},
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          },
        ],
        total: 25,
        page: 2,
        pageSize: 20,
        summaries: {
          principalAmount: {
            total: 500000000,
            pageSubtotal: 100000000,
            cumulative: 300000000,
          },
        },
      }),
      findColumnOptions: jest.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          next: null,
          previous: null,
        },
      }),
      findOne: jest.fn().mockResolvedValue({ id: 'l1' }),
      getCashflowProjection: jest
        .fn()
        .mockResolvedValue({ monthlyProjections: [] }),
    };

    commandService = {
      create: jest.fn().mockResolvedValue({ id: 'l1' }),
      update: jest.fn().mockResolvedValue({ id: 'l1' }),
      remove: jest.fn().mockResolvedValue(undefined),
      hardDelete: jest.fn().mockResolvedValue(undefined),
      recordPayment: jest.fn().mockResolvedValue({ id: 'l1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: LoanQueryService, useValue: queryService },
        { provide: LoanCommandService, useValue: commandService },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
  });

  it('should delegate findAll to LoanQueryService and return V2 paginated envelope', async () => {
    const q = { page: 2, pageSize: 20, summary_keys: 'principalAmount' };
    const res = await service.findAll(q);

    expect(queryService.findAll).toHaveBeenCalledWith(q);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].principalAmount).toBe(100000000);
    expect(res.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 25,
      totalPages: 2,
      next: null,
      previous: 1,
    });
    expect(res.summaries).toEqual({
      principalAmount: {
        total: 500000000,
        pageSubtotal: 100000000,
        cumulative: 300000000,
      },
    });
  });

  it('should delegate findColumnOptions to LoanQueryService', async () => {
    await service.findColumnOptions('lenderName', 'VCB', 1, 20, '{}', 'only');
    expect(queryService.findColumnOptions).toHaveBeenCalledWith(
      'lenderName',
      'VCB',
      1,
      20,
      '{}',
      'only',
    );
  });

  it('should delegate hardDelete to LoanCommandService and return id', async () => {
    const res = await service.hardDelete('l1');
    expect(commandService.hardDelete).toHaveBeenCalledWith('l1');
    expect(res).toEqual({ id: 'l1' });
  });

  it('should delegate create to LoanCommandService', async () => {
    const dto = {
      title: 'Loan',
      lenderName: 'Bank',
      principalAmount: 1000,
      annualInterestRate: 10,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
    };
    await service.create(dto, 'u1');
    expect(commandService.create).toHaveBeenCalledWith(dto, 'u1');
  });

  it('should simulate calculation via engine directly', () => {
    const sim = service.simulate({
      principalAmount: 12000000,
      annualInterestRate: 10,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
    });
    expect(sim.schedule.length).toBe(12);
  });
});
