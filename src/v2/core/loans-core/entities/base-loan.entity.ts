import { Column, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';
import {
  AmortizationMethod,
  LoanStatus,
} from '../enums/loan-amortization.enum';

/**
 * Lớp nền hợp đồng vay (abstract, không @Entity).
 * Module loans kế thừa và khai báo @Entity('loans').
 */
export abstract class BaseLoanEntity extends CoreSoftDeletableEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, name: 'loan_code' })
  loanCode: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, name: 'lender_name' })
  lenderName: string;

  @Index()
  @Column({ type: 'uuid', name: 'partner_id', nullable: true })
  partnerId: string | null;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'principal_amount',
  })
  principalAmount: string;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'annual_interest_rate',
  })
  annualInterestRate: string;

  @Column({ type: 'integer', name: 'tenor_months' })
  tenorMonths: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'amortization_method',
  })
  amortizationMethod: AmortizationMethod;

  @Index()
  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'first_payment_date' })
  firstPaymentDate: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'total_paid_principal',
    default: 0,
  })
  totalPaidPrincipal: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'total_paid_interest',
    default: 0,
  })
  totalPaidInterest: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'remaining_principal',
  })
  remainingPrincipal: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: LoanStatus.ACTIVE,
  })
  status: LoanStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, name: 'created_by', nullable: true })
  createdBy: string | null;
}
