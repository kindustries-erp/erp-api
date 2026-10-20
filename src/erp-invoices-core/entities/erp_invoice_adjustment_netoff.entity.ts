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

@Entity({ name: 'erp_invoice_adjustment_netoff' })
export class ErpInvoiceAdjustmentNetOff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'original_invoice_id' })
  originalInvoiceId: string;

  @ManyToOne('ErpInvoice', (invoice: any) => invoice.adjustingNetOffs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'original_invoice_id' })
  originalInvoice: import('typeorm').Relation<ErpInvoice>;

  @Column({ type: 'uuid', name: 'adjusting_invoice_id' })
  adjustingInvoiceId: string;

  @ManyToOne('ErpInvoice', (invoice: any) => invoice.adjustedByNetOffs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'adjusting_invoice_id' })
  adjustingInvoice: import('typeorm').Relation<ErpInvoice>;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'offset_amount',
    default: 0,
  })
  offsetAmount: number;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'offset_type',
    default: 'REDUCTION',
  })
  offsetType: string; // REDUCTION | FULL_CANCELLATION

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
