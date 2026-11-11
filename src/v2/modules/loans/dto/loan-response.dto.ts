import {
  AmortizationMethod,
  LoanSchedulePeriod,
  LoanStatus,
} from '@/v2/core/loans-core';

export class LoanPaymentResponseDto {
  id: string;
  loanId: string;
  periodNumber: number;
  paymentDate: string;
  principalPaid: number;
  interestPaid: number;
  totalPaid: number;
  paymentRef: string | null;
  notes: string | null;
  createdBy: string | null;
  extraData?: Record<string, unknown>;
  createdAt: Date;
}

export class LoanResponseDto {
  id: string;
  loanCode: string;
  title: string;
  lenderName: string;
  partnerId: string | null;
  principalAmount: number;
  annualInterestRate: number;
  tenorMonths: number;
  amortizationMethod: AmortizationMethod;
  startDate: string;
  firstPaymentDate: string;
  totalPaidPrincipal: number;
  totalPaidInterest: number;
  remainingPrincipal: number;
  status: LoanStatus;
  notes: string | null;
  createdBy: string | null;
  extraData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  schedule?: LoanSchedulePeriod[];
  payments?: LoanPaymentResponseDto[];
}

export class LoanListResponseDto {
  items: LoanResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class MonthlyCashflowProjectionDto {
  month: string; // YYYY-MM
  principalDue: number;
  interestDue: number;
  totalPaymentDue: number;
  cumulativeRemainingPrincipal: number;
  activeLoanCount: number;
}

export class CashflowProjectionResponseDto {
  monthlyProjections: MonthlyCashflowProjectionDto[];
  totalPrincipalDue: number;
  totalInterestDue: number;
  totalObligationDue: number;
}
