import { AmortizationMethod } from '../enums/loan-amortization.enum';
import {
  LoanRecalculateInput,
  LoanSchedulePeriod,
  LoanSimulationInput,
  LoanSimulationResult,
} from '../interfaces/loan-contract.interface';

export class LoanAmortizationEngine {
  private static round2(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  private static addMonths(dateStr: string, monthsToAdd: number): string {
    const d = new Date(dateStr);
    const day = d.getDate();
    d.setMonth(d.getMonth() + monthsToAdd);
    if (d.getDate() !== day) {
      d.setDate(0); // handle month end overflow (e.g. Jan 31 -> Feb 28)
    }
    return d.toISOString().split('T')[0];
  }

  public static calculatePmt(
    principal: number,
    annualRate: number,
    tenorMonths: number,
  ): number {
    if (annualRate <= 0) return this.round2(principal / tenorMonths);
    const r = annualRate / 100 / 12;
    const factor = Math.pow(1 + r, tenorMonths);
    return this.round2((principal * (r * factor)) / (factor - 1));
  }

  public static generateSchedule(
    input: LoanSimulationInput,
  ): LoanSimulationResult {
    const {
      principalAmount: P,
      annualInterestRate: rate,
      tenorMonths: n,
      amortizationMethod: method,
      startDate,
    } = input;
    let firstDate = input.firstPaymentDate;
    if (!firstDate || firstDate < startDate) {
      firstDate = this.addMonths(startDate, 1);
    }
    const monthlyRate = rate / 100 / 12;

    const schedule: LoanSchedulePeriod[] = [];
    let curBal = P;
    let totalInterest = 0;
    const pmt = this.calculatePmt(P, rate, n);
    const flatTotalInterest = this.round2(P * (rate / 100) * (n / 12));
    const flatMonthlyInterest = this.round2(flatTotalInterest / n);
    const equalPrincipal = this.round2(P / n);

    // Tính thời gian ân hạn cho phương thức GRACE_PERIOD
    const graceMonths = Math.min(Math.max(1, Math.floor(n / 3)), 6);
    const postGraceTenor = Math.max(1, n - graceMonths);
    const graceEqualPrincipal = this.round2(P / postGraceTenor);

    for (let k = 1; k <= n; k++) {
      const dueDate = this.addMonths(firstDate, k - 1);
      const begBal = curBal;
      let pDue = 0;
      let iDue = 0;

      if (method === AmortizationMethod.AMORTIZED) {
        iDue = this.round2(begBal * monthlyRate);
        pDue = k === n ? begBal : this.round2(pmt - iDue);
      } else if (method === AmortizationMethod.EQUAL_PRINCIPAL) {
        pDue = k === n ? begBal : equalPrincipal;
        iDue = this.round2(begBal * monthlyRate);
      } else if (method === AmortizationMethod.BULLET) {
        iDue = this.round2(begBal * monthlyRate);
        pDue = k === n ? begBal : 0;
      } else if (method === AmortizationMethod.FLAT) {
        pDue = k === n ? begBal : equalPrincipal;
        iDue =
          k === n
            ? flatTotalInterest - (k - 1) * flatMonthlyInterest
            : flatMonthlyInterest;
      } else if (method === AmortizationMethod.GRACE_PERIOD) {
        iDue = this.round2(begBal * monthlyRate);
        if (k <= graceMonths) {
          pDue = 0; // Trong thời gian ân hạn chỉ trả lãi
        } else {
          pDue = k === n ? begBal : graceEqualPrincipal;
        }
      } else if (method === AmortizationMethod.MATURITY_LUMP_SUM) {
        if (k === n) {
          pDue = begBal;
          iDue = flatTotalInterest;
        } else {
          pDue = 0;
          iDue = 0;
        }
      }

      const totalDue = this.round2(pDue + iDue);
      const endBal = k === n ? 0 : this.round2(begBal - pDue);
      curBal = endBal;
      totalInterest += iDue;

      schedule.push({
        periodNumber: k,
        dueDate,
        beginningBalance: begBal,
        principalDue: pDue,
        interestDue: iDue,
        totalPaymentDue: totalDue,
        endingBalance: endBal,
      });
    }

    const roundedTotalInterest = this.round2(totalInterest);
    const totalAmount = this.round2(P + roundedTotalInterest);
    const monthlyEstimate =
      method === AmortizationMethod.AMORTIZED
        ? pmt
        : this.round2(totalAmount / n);

    return {
      principalAmount: P,
      annualInterestRate: rate,
      tenorMonths: n,
      amortizationMethod: method,
      startDate,
      firstPaymentDate: firstDate,
      monthlyPaymentEstimate: monthlyEstimate,
      totalInterestDue: roundedTotalInterest,
      totalAmountDue: totalAmount,
      schedule,
    };
  }

  /**
   * Tính toán lại lịch trả nợ động dựa trên lịch sử thanh toán thực tế.
   * - Các kỳ đã trả: hiển thị số tiền gốc, lãi thực tế đã thanh toán và trạng thái isPaid = true.
   * - Các kỳ tương lai: tính toán lại từ số dư nợ gốc thực tế còn lại và số kỳ còn lại.
   */
  public static recalculateSchedule(
    input: LoanRecalculateInput,
  ): LoanSimulationResult {
    const {
      principalAmount: P,
      annualInterestRate: rate,
      tenorMonths: n,
      amortizationMethod: method,
      startDate,
      payments = [],
    } = input;

    if (!payments || payments.length === 0) {
      return this.generateSchedule(input);
    }

    let firstDate = input.firstPaymentDate;
    if (!firstDate || firstDate < startDate) {
      firstDate = this.addMonths(startDate, 1);
    }
    const monthlyRate = rate / 100 / 12;

    const sortedPayments = [...payments].sort(
      (a, b) => a.periodNumber - b.periodNumber,
    );
    const paymentMap = new Map<number, (typeof payments)[0]>();
    for (const p of sortedPayments) {
      paymentMap.set(p.periodNumber, p);
    }
    const maxPaidPeriod =
      sortedPayments[sortedPayments.length - 1]?.periodNumber || 0;

    const schedule: LoanSchedulePeriod[] = [];
    let curBal = P;
    let totalInterest = 0;

    // 1. Ghi nhận các kỳ đã thanh toán thực tế (1 .. maxPaidPeriod)
    for (let k = 1; k <= maxPaidPeriod; k++) {
      const dueDate = this.addMonths(firstDate, k - 1);
      const begBal = curBal;
      const pRec = paymentMap.get(k);

      if (pRec) {
        const pPaid = this.round2(pRec.principalPaid);
        const iPaid = this.round2(pRec.interestPaid);
        const endBal = this.round2(Math.max(0, begBal - pPaid));
        curBal = endBal;
        totalInterest += iPaid;

        schedule.push({
          periodNumber: k,
          dueDate,
          beginningBalance: begBal,
          principalDue: pPaid,
          interestDue: iPaid,
          totalPaymentDue: this.round2(pPaid + iPaid),
          endingBalance: endBal,
          isPaid: true,
          actualPaymentDate: pRec.paymentDate,
          actualPrincipalPaid: pPaid,
          actualInterestPaid: iPaid,
          actualTotalPaid: this.round2(pPaid + iPaid),
          paymentRef: pRec.paymentRef || null,
        });
      } else {
        const iDue = this.round2(begBal * monthlyRate);
        schedule.push({
          periodNumber: k,
          dueDate,
          beginningBalance: begBal,
          principalDue: 0,
          interestDue: iDue,
          totalPaymentDue: iDue,
          endingBalance: begBal,
          isPaid: false,
        });
        totalInterest += iDue;
      }
    }

    if (input.remainingPrincipal !== undefined) {
      curBal = this.round2(Number(input.remainingPrincipal));
    }

    // 2. Tính toán lại cho các kỳ tương lai (maxPaidPeriod + 1 .. n)
    const remainingTenor = Math.max(0, n - maxPaidPeriod);
    const pmtRem =
      remainingTenor > 0 ? this.calculatePmt(curBal, rate, remainingTenor) : 0;
    const equalPRem =
      remainingTenor > 0 ? this.round2(curBal / remainingTenor) : 0;
    const flatTotalInterestRem = this.round2(
      curBal * (rate / 100) * (remainingTenor / 12),
    );
    const flatMonthlyInterestRem =
      remainingTenor > 0
        ? this.round2(flatTotalInterestRem / remainingTenor)
        : 0;

    for (let k = maxPaidPeriod + 1; k <= n; k++) {
      const dueDate = this.addMonths(firstDate, k - 1);
      const begBal = curBal;
      let pDue = 0;
      let iDue = 0;

      if (begBal <= 0) {
        schedule.push({
          periodNumber: k,
          dueDate,
          beginningBalance: 0,
          principalDue: 0,
          interestDue: 0,
          totalPaymentDue: 0,
          endingBalance: 0,
          isPaid: false,
        });
        continue;
      }

      if (method === AmortizationMethod.AMORTIZED) {
        iDue = this.round2(begBal * monthlyRate);
        pDue = k === n ? begBal : this.round2(pmtRem - iDue);
      } else if (method === AmortizationMethod.EQUAL_PRINCIPAL) {
        pDue = k === n ? begBal : equalPRem;
        iDue = this.round2(begBal * monthlyRate);
      } else if (method === AmortizationMethod.BULLET) {
        iDue = this.round2(begBal * monthlyRate);
        pDue = k === n ? begBal : 0;
      } else if (method === AmortizationMethod.FLAT) {
        pDue = k === n ? begBal : equalPRem;
        const periodIdx = k - maxPaidPeriod;
        iDue =
          periodIdx === remainingTenor
            ? this.round2(
                flatTotalInterestRem - (periodIdx - 1) * flatMonthlyInterestRem,
              )
            : flatMonthlyInterestRem;
      } else if (method === AmortizationMethod.GRACE_PERIOD) {
        const graceMonths = Math.min(Math.max(1, Math.floor(n / 3)), 6);
        iDue = this.round2(begBal * monthlyRate);
        if (k <= graceMonths) {
          pDue = 0;
        } else {
          const postGraceRemaining = Math.max(
            1,
            n - Math.max(graceMonths, maxPaidPeriod),
          );
          pDue = k === n ? begBal : this.round2(begBal / postGraceRemaining);
        }
      } else if (method === AmortizationMethod.MATURITY_LUMP_SUM) {
        if (k === n) {
          pDue = begBal;
          iDue = flatTotalInterestRem;
        } else {
          pDue = 0;
          iDue = 0;
        }
      }

      const totalDue = this.round2(pDue + iDue);
      const endBal = k === n ? 0 : this.round2(begBal - pDue);
      curBal = endBal;
      totalInterest += iDue;

      schedule.push({
        periodNumber: k,
        dueDate,
        beginningBalance: begBal,
        principalDue: pDue,
        interestDue: iDue,
        totalPaymentDue: totalDue,
        endingBalance: endBal,
        isPaid: false,
      });
    }

    const roundedTotalInterest = this.round2(totalInterest);
    const totalAmount = this.round2(P + roundedTotalInterest);
    const monthlyEstimate =
      remainingTenor > 0
        ? method === AmortizationMethod.AMORTIZED
          ? pmtRem
          : this.round2((curBal + roundedTotalInterest) / remainingTenor)
        : 0;

    return {
      principalAmount: P,
      annualInterestRate: rate,
      tenorMonths: n,
      amortizationMethod: method,
      startDate,
      firstPaymentDate: firstDate,
      monthlyPaymentEstimate: monthlyEstimate,
      totalInterestDue: roundedTotalInterest,
      totalAmountDue: totalAmount,
      schedule,
    };
  }
}
