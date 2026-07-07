import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ErpInvoice } from './erp_invoice.entity';
import { ErpBankTransaction } from '../../bank-transactions-core/entities/erp_bank_transaction.entity';

@Entity({ name: 'erp_invoice_voucher_netoff' })
export class ErpInvoiceVoucherNetOff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne('ErpInvoice', (invoice: any) => invoice.voucherNetOffs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: import('typeorm').Relation<ErpInvoice>;

  @Column({ type: 'uuid', name: 'bank_transaction_id' })
  bankTransactionId: string;

  @ManyToOne(
    'ErpBankTransaction',
    (transaction: any) => transaction.invoiceNetOffs,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'bank_transaction_id' })
  bankTransaction: ErpBankTransaction;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'net_off_amount',
    default: 0,
  })
  netOffAmount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
