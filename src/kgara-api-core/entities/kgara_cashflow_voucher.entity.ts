import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { KgaraCase } from './kgara_case.entity';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

@Entity('kgara_cashflow_vouchers')
@Index('IDX_gara_cashflow_code', ['voucherCode'])
@Index('IDX_gara_cashflow_case', ['caseId'])
@Index('IDX_gara_cashflow_trans_date', ['transDate'])
@Index('IDX_gara_cashflow_license_plate', ['licensePlate'])
@Index('IDX_gara_cashflow_payment_method', ['paymentMethod'])
@Index('IDX_gara_cashflow_payment_content', ['paymentContent'])
@Index('IDX_gara_cashflow_payment_status', ['paymentStatus'])
@Index('IDX_gara_cashflow_auto_expected', [
  'caseId',
  'voucherType',
  'paymentStatus',
  'isAutoExpected',
])
export class KgaraCashflowVoucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'voucher_code', unique: true })
  voucherCode: string;

  @Column({ type: 'varchar', length: 20, name: 'voucher_type' })
  voucherType: 'RECEIPT' | 'PAYMENT';

  @Column({ type: 'numeric', precision: 18, scale: 2, default: 0 })
  amount: number;

  @Column({ type: 'date', name: 'trans_date' })
  transDate: string;

  @Column({ type: 'uuid', name: 'case_id', nullable: true })
  caseId?: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate?: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_method',
    nullable: true,
  })
  paymentMethod?: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'payment_content',
    nullable: true,
  })
  paymentContent?: string;

  @Column({
    type: 'varchar',
    length: 30,
    name: 'payment_status',
    nullable: true,
  })
  paymentStatus?:
    | 'PENDING'
    | 'APPROVED'
    | 'PAID'
    | 'EXPECTED'
    | 'CANCELLED'
    | null;

  @Column({
    type: 'boolean',
    name: 'is_auto_expected',
    default: false,
    nullable: true,
  })
  isAutoExpected?: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'partner_name',
    nullable: true,
  })
  partnerName?: string;

  @Column({ type: 'uuid', name: 'erp_bank_transaction_id', nullable: true })
  erpBankTransactionId?: string;

  @Column({ type: 'uuid', name: 'erp_cash_voucher_id', nullable: true })
  erpCashVoucherId?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'varchar', length: 255, name: 'created_by', nullable: true })
  createdBy?: string;

  @Column({
    type: 'boolean',
    name: 'is_auto_commission',
    default: false,
    nullable: true,
  })
  isAutoCommission?: boolean;

  @Column({ type: 'smallint', name: 'pnl_period_year', nullable: true })
  pnlPeriodYear?: number | null;

  @Column({ type: 'smallint', name: 'pnl_period_month', nullable: true })
  pnlPeriodMonth?: number | null;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'pnl_commission_type',
    nullable: true,
  })
  pnlCommissionType?: 'HOA_HONG_SALE' | 'HOA_HONG_DV' | string | null;

  @Column({ type: 'uuid', name: 'pnl_commission_anchor_id', nullable: true })
  pnlCommissionAnchorId?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => KgaraCase, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'case_id' })
  case?: KgaraCase;

  @ManyToOne(() => ErpBankTransaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'erp_bank_transaction_id' })
  erpBankTransaction?: ErpBankTransaction;
}
