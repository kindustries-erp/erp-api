import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '@/common/dto/pagination-meta.dto';
import {
  SUMMARIES_SWAGGER_SCHEMA,
  SummaryMetricDto,
} from '@/common/dto/summary-metric.dto';
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

/** Response danh sách khoản vay chuẩn v2: `items`, `pagination`, `summaries`. */
export class LoanListResponseDto {
  @ApiProperty({ type: () => [LoanResponseDto] })
  items: LoanResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination: PaginationMetaDto;

  @ApiProperty(SUMMARIES_SWAGGER_SCHEMA)
  summaries: Record<string, SummaryMetricDto | null>;
}

export class CashflowLoanBreakdownDto {
  loanId: string;
  loanName: string;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalPayment: number;
  endingBalance: number;
}

export class MonthlyCashflowProjectionDto {
  month: string; // YYYY-MM
  principalDue: number;
  interestDue: number;
  totalPaymentDue: number;
  cumulativeRemainingPrincipal: number;
  activeLoanCount: number;
  breakdown?: CashflowLoanBreakdownDto[];
}

export class CashflowProjectionResponseDto {
  monthlyProjections: MonthlyCashflowProjectionDto[];
  totalPrincipalDue: number;
  totalInterestDue: number;
  totalObligationDue: number;
}
