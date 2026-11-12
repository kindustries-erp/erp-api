import { Entity, OneToMany, type Relation } from 'typeorm';
import { BaseLoanEntity } from '@/v2/core/loans-core/entities/base-loan.entity';
import type { LoanPaymentEntity } from './loan-payment.entity';

@Entity({ name: 'loans_finance' })
export class LoanEntity extends BaseLoanEntity {
  @OneToMany('LoanPaymentEntity', (payment: any) => payment.loan)
  payments?: Relation<LoanPaymentEntity[]>;
}
