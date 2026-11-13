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

  it('should generate GRACE_PERIOD schedule with zero principal during grace period', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 120000000,
      annualInterestRate: 12,
      tenorMonths: 12,
      amortizationMethod: AmortizationMethod.GRACE_PERIOD,
      startDate: '2026-01-01',
    });

    expect(res.schedule.length).toBe(12);
    // Period 1 is within grace period (principal = 0, interest > 0)
    expect(res.schedule[0].principalDue).toBe(0);
    expect(res.schedule[0].interestDue).toBe(1200000);
    // Final period should clear the ending balance
    expect(res.schedule[11].endingBalance).toBe(0);
  });

  it('should generate MATURITY_LUMP_SUM schedule with principal and total interest paid at final period', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 50000000,
      annualInterestRate: 12,
      tenorMonths: 6,
      amortizationMethod: AmortizationMethod.MATURITY_LUMP_SUM,
      startDate: '2026-01-01',
    });

    expect(res.schedule.length).toBe(6);
    expect(res.schedule[0].principalDue).toBe(0);
    expect(res.schedule[0].interestDue).toBe(0);
    expect(res.schedule[5].principalDue).toBe(50000000);
    expect(res.schedule[5].interestDue).toBe(3000000); // 50m * 12% * (6/12)
    expect(res.schedule[5].endingBalance).toBe(0);
  });

  it('should auto normalize firstPaymentDate if earlier than startDate', () => {
    const res = LoanAmortizationEngine.generateSchedule({
      principalAmount: 10000000,
      annualInterestRate: 10,
      tenorMonths: 3,
      amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
      startDate: '2025-10-01',
      firstPaymentDate: '2020-01-01', // Outdated/broken date
    });

    // Should normalize to next month after startDate: 2025-11-01
    expect(res.schedule[0].dueDate).toBe('2025-11-01');
  });

  describe('recalculateSchedule', () => {
    it('should return standard schedule if no payments provided', () => {
      const res = LoanAmortizationEngine.recalculateSchedule({
        principalAmount: 100000000,
        annualInterestRate: 12,
        tenorMonths: 6,
        amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
        startDate: '2026-01-01',
        payments: [],
      });

      expect(res.schedule.length).toBe(6);
      expect(res.schedule[0].isPaid).toBeUndefined();
    });

    it('should record actual payment in period 1 and recalculate future periods', () => {
      const res = LoanAmortizationEngine.recalculateSchedule({
        principalAmount: 60000000,
        annualInterestRate: 12,
        tenorMonths: 6,
        amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
        startDate: '2026-01-01',
        remainingPrincipal: 50000000,
        payments: [
          {
            periodNumber: 1,
            paymentDate: '2026-02-01',
            principalPaid: 10000000,
            interestPaid: 600000,
          },
        ],
      });

      expect(res.schedule.length).toBe(6);
      // Period 1 is marked paid with actual amounts
      expect(res.schedule[0].isPaid).toBe(true);
      expect(res.schedule[0].principalDue).toBe(10000000);
      expect(res.schedule[0].interestDue).toBe(600000);
      expect(res.schedule[0].endingBalance).toBe(50000000);

      // Period 2 starts with 50,000,000 beginning balance
      expect(res.schedule[1].beginningBalance).toBe(50000000);
      expect(res.schedule[1].isPaid).toBe(false);

      // Final period ends at exactly 0
      expect(res.schedule[5].endingBalance).toBe(0);
    });

    it('should handle prepayment and reduce future monthly principal in EQUAL_PRINCIPAL', () => {
      // Normal schedule: 60m / 6 = 10m/mo.
      // But user pays 20m in period 1. Remaining is 40m over 5 periods = 8m/mo.
      const res = LoanAmortizationEngine.recalculateSchedule({
        principalAmount: 60000000,
        annualInterestRate: 12,
        tenorMonths: 6,
        amortizationMethod: AmortizationMethod.EQUAL_PRINCIPAL,
        startDate: '2026-01-01',
        remainingPrincipal: 40000000,
        payments: [
          {
            periodNumber: 1,
            paymentDate: '2026-02-01',
            principalPaid: 20000000,
            interestPaid: 600000,
          },
        ],
      });

      expect(res.schedule[0].isPaid).toBe(true);
      expect(res.schedule[0].endingBalance).toBe(40000000);
      // Remaining 5 periods should each pay 40m / 5 = 8m
      expect(res.schedule[1].principalDue).toBe(8000000);
      expect(res.schedule[5].endingBalance).toBe(0);
    });

    it('should set future obligations to 0 when loan is fully settled early', () => {
      const res = LoanAmortizationEngine.recalculateSchedule({
        principalAmount: 60000000,
        annualInterestRate: 12,
        tenorMonths: 6,
        amortizationMethod: AmortizationMethod.AMORTIZED,
        startDate: '2026-01-01',
        remainingPrincipal: 0,
        payments: [
          {
            periodNumber: 1,
            paymentDate: '2026-02-01',
            principalPaid: 60000000,
            interestPaid: 600000,
          },
        ],
      });

      expect(res.schedule[0].isPaid).toBe(true);
      expect(res.schedule[0].endingBalance).toBe(0);
      // Future periods should have 0 obligation
      expect(res.schedule[1].principalDue).toBe(0);
      expect(res.schedule[1].interestDue).toBe(0);
      expect(res.schedule[1].totalPaymentDue).toBe(0);
      expect(res.schedule[5].endingBalance).toBe(0);
    });
  });
});
