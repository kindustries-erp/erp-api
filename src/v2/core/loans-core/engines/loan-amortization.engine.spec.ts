import { LoanAmortizationEngine } from './loan-amortization.engine';
import { AmortizationMethod } from '../enums/loan-amortization.enum';

describe('LoanAmortizationEngine', () => {
  it('should calculate PMT correctly for an amortized loan', () => {
    // 120,000,000 VND, 12% per year (1% per month), 12 months
    // PMT formula: 120000000 * (0.01 * 1.01^12) / (1.01^12 - 1) = 10,661,854.91
    const pmt = LoanAmortizationEngine.calculatePmt(120000000, 12, 12);
    expect(pmt).toBeCloseTo(10661854.91, -1);
  });

  it('should generate AMORTIZED schedule with zero ending balance', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 100000000,
      annualInterestRate: 12,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.AMORTIZED,
      startDate: '2026-01-01',
      firstPaymentDate: '2026-02-01',
    });

    expect(res.schedule.length).toBe(12);
    expect(res.schedule[0].periodNumber).toBe(1);
    expect(res.schedule[0].dueDate).toBe('2026-02-01');
    expect(res.schedule[0].beginningBalance).toBe(100000000);
    // Ending balance at last period must be strictly 0
    expect(res.schedule[11].endingBalance).toBe(0);

    const totalPrincipal = res.schedule.reduce(
      (sum, item) => sum + item.principalDue,
      0,
    );
    expect(Math.round(totalPrincipal)).toBe(100000000);
  });

  it('should generate EQUAL_PRINCIPAL schedule with reducing interest', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 120000000,
      annualInterestRate: 12,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2026-01-01',
    });

    expect(res.schedule.length).toBe(12);
    // Period 1 interest > Period 2 interest
    expect(res.schedule[0].interestDue).toBeGreaterThan(
      res.schedule[1].interestDue,
    );
    expect(res.schedule[11].endingBalance).toBe(0);

    const totalPrincipal = res.schedule.reduce(
      (sum, item) => sum + item.principalDue,
      0,
    );
    expect(Math.round(totalPrincipal)).toBe(120000000);
  });

  it('should generate BULLET schedule with principal paid only in the final period', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 50000000,
      annualInterestRate: 10,
      tenorMonths: 6,
      amortizationMethod: AmortizationMethod.BULLET,
      startDate: '2026-01-01',
    });

    expect(res.schedule.length).toBe(6);
    expect(res.schedule[0].principalDue).toBe(0);
    expect(res.schedule[4].principalDue).toBe(0);
    expect(res.schedule[5].principalDue).toBe(50000000);
    expect(res.schedule[5].endingBalance).toBe(0);
  });

  it('should generate FLAT interest schedule', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 60000000,
      annualInterestRate: 12,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.FLAT,
      startDate: '2026-01-01',
    });

    expect(res.schedule.length).toBe(12);
    // Total interest should be 60,000,000 * 0.12 * 1 = 7,200,000
    expect(res.totalInterestDue).toBe(7200000);
    expect(res.schedule[11].endingBalance).toBe(0);
  });
});
