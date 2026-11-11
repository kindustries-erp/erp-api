import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LoanQueryService } from './loan-query.service';
import { LoanEntity } from '../entities';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

describe('LoanQueryService', () => {
  let service: LoanQueryService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn(),
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

  it('should aggregate cashflow projection for active loans', async () => {
    const mockLoan = {
      id: 'l1',
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
  });
});
