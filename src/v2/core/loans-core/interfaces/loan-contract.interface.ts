import {
  AmortizationMethod,
  LoanStatus,
} from '../enums/loan-amortization.enum';

export interface LoanSimulationInput {
  principalAmount: number;
  annualInterestRate: number;
  tenorMonths: number;
  amortizationMethod: AmortizationMethod;
  startDate: string; // ISO date YYYY-MM-DD
  firstPaymentDate?: string; // Optional custom first payment date
}

export interface LoanSchedulePeriod {
  periodNumber: number;
  dueDate: string;
  beginningBalance: number;
  principalDue: number;
  interestDue: number;
  totalPaymentDue: number;
  endingBalance: number;
}

export interface LoanSimulationResult {
  principalAmount: number;
  annualInterestRate: number;
  tenorMonths: number;
  amortizationMethod: AmortizationMethod;
  startDate: string;
  firstPaymentDate: string;
  monthlyPaymentEstimate: number;
  totalInterestDue: number;
  totalAmountDue: number;
  schedule: LoanSchedulePeriod[];
}

export interface LoanContractSummary {
  id: string;
  loanCode: string;
  title: string;
  lenderName: string;
  partnerId?: string | null;
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
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
