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

  @Column({ type: 'uuid', name: 'erp_bank_transaction_id', nullable: true })
  erpBankTransactionId?: string;

  @Column({ type: 'uuid', name: 'erp_cash_voucher_id', nullable: true })
  erpCashVoucherId?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'varchar', length: 50, name: 'created_by', nullable: true })
  createdBy?: string;

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
