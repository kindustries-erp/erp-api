import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_expense_account_rules' })
@Unique(['categoryKey', 'accrualMode'])
export class ErpExpenseAccountRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'category_key' })
  categoryKey: string;

  @Column({ type: 'varchar', length: 255, name: 'category_label' })
  categoryLabel: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'accrual_mode',
    default: 'NONE',
  })
  accrualMode: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'direct_debit_account_code',
    default: '6422',
    nullable: true,
  })
  directDebitAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'direct_credit_account_code',
    default: '1121',
    nullable: true,
  })
  directCreditAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'accrual_debit_account_code',
    default: '6422',
    nullable: true,
  })
  accrualDebitAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'accrual_credit_account_code',
    default: '335',
    nullable: true,
  })
  accrualCreditAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'settle_debit_account_code',
    default: '335',
    nullable: true,
  })
  settleDebitAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'settle_credit_account_code',
    default: '331',
    nullable: true,
  })
  settleCreditAccountCode: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'settle_vat_account_code',
    default: '1331',
    nullable: true,
  })
  settleVatAccountCode: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
