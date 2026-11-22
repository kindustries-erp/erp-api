import { LoanMapper } from './loan.mapper';
import { LoanEntity } from '../entities/loan.entity';
import { AmortizationMethod, LoanStatus } from '@/v2/core/loans-core';

describe('LoanMapper', () => {
  it('should map LoanEntity to LoanResponseDto correctly', () => {
    const entity = new LoanEntity();
    entity.id = '11111111-1111-1111-1111-111111111111';
    entity.loanCode = 'LOAN-001';
    entity.title = 'Test Loan';
    entity.lenderName = 'Test Bank';
    entity.partnerId = null;
    entity.principalAmount = '100000000';
    entity.annualInterestRate = '10';
    entity.tenorMonths = 12;
    entity.amortizationMethod = AmortizationMethod.AMORTIZED;
    entity.startDate = '2026-01-01';
    entity.firstPaymentDate = '2026-02-01';
    entity.totalPaidPrincipal = '10000000';
    entity.totalPaidInterest = '1000000';
    entity.remainingPrincipal = '90000000';
    entity.status = LoanStatus.ACTIVE;
    entity.createdAt = new Date('2026-01-01T00:00:00Z');
    entity.updatedAt = new Date('2026-01-01T00:00:00Z');

    const dto = LoanMapper.toDto(entity, true);

    expect(dto.id).toBe(entity.id);
    expect(dto.loanCode).toBe('LOAN-001');
    expect(dto.principalAmount).toBe(100000000);
    expect(dto.remainingPrincipal).toBe(90000000);
    expect(dto.schedule).toBeDefined();
    expect(dto.schedule?.length).toBe(12);
  });
});
