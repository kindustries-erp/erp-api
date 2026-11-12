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

  it('should delegate findAll to LoanQueryService', async () => {
    const q = { page: 1, pageSize: 20 };
    await service.findAll(q);
    expect(queryService.findAll).toHaveBeenCalledWith(q);
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
