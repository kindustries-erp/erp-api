import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ErpBranch } from '../../branches-core/entities/erp_branch.entity';
import { ErpBankAccount } from './erp_bank_account.entity';
import { ErpCashBook } from './erp_cash_book.entity';
import { ErpInvoiceVoucherNetOff } from '../../erp-invoices-core/entities/erp_invoice_voucher_netoff.entity';

@Entity({ name: 'erp_bank_transactions' })
export class ErpBankTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, name: 'source_type' })
  sourceType: 'BANK' | 'CASH';

  @Column({ type: 'uuid', name: 'bank_account_id', nullable: true })
  bankAccountId: string | null;

  @ManyToOne(() => ErpBankAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: ErpBankAccount | null;

  @Column({ type: 'uuid', name: 'cash_book_id', nullable: true })
  cashBookId: string | null;

  @ManyToOne(() => ErpCashBook)
  @JoinColumn({ name: 'cash_book_id' })
  cashBook: ErpCashBook | null;

  @Column({ type: 'uuid', name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => ErpBranch)
  @JoinColumn({ name: 'branch_id' })
  branch: ErpBranch;

  @Column({ type: 'int', name: 'stt', nullable: true })
  stt: number | null;

  @Column({ type: 'timestamp', name: 'trans_date' })
  transDate: Date;

  @Column({ type: 'timestamp', name: 'efd_date', nullable: true })
  efdDate: Date | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'reference_number',
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'debit_amount',
    default: 0,
  })
  debitAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'credit_amount',
    default: 0,
  })
  creditAmount: number;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'balance',
    nullable: true,
  })
  balance: number | null;

  @Column({ type: 'varchar', length: 100, name: 'seq_no', nullable: true })
  seqNo: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'correspondent_account',
    nullable: true,
  })
  correspondentAccount: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'correspondent_name',
    nullable: true,
  })
  correspondentName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'correspondent_bank',
    nullable: true,
  })
  correspondentBank: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'import_batch_id',
    nullable: true,
  })
  importBatchId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    'ErpInvoiceVoucherNetOff',
    (netOff: ErpInvoiceVoucherNetOff) => netOff.bankTransaction,
  )
  invoiceNetOffs: ErpInvoiceVoucherNetOff[];
}
