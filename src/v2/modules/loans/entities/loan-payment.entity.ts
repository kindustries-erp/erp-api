import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';
import type { LoanEntity } from './loan.entity';

@Entity({ name: 'loan_payments_finance' })
export class LoanPaymentEntity extends CoreSoftDeletableEntity {
  @Index()
  @Column({ type: 'uuid', name: 'loan_id' })
  loanId: string;

  @ManyToOne('LoanEntity', (loan: any) => loan.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'loan_id' })
  loan?: Relation<LoanEntity>;

  @Column({ type: 'integer', name: 'period_number' })
  periodNumber: number;

  @Index()
  @Column({ type: 'date', name: 'payment_date' })
  paymentDate: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'principal_paid',
    default: 0,
  })
  principalPaid: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'interest_paid',
    default: 0,
  })
  interestPaid: string;

  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'total_paid',
  })
  totalPaid: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'payment_ref',
    nullable: true,
  })
  paymentRef: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 100, name: 'created_by', nullable: true })
  createdBy: string | null;
}
