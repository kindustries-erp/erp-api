import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { ErpInvoice } from './erp_invoice.entity';
import { ErpAttachment } from '../../erp-attachments-core/entities/erp_attachment.entity';

@Entity({ name: 'erp_invoice_attachments' })
export class ErpInvoiceAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  @Column({ type: 'uuid', name: 'attachment_id' })
  attachmentId: string;

  @ManyToOne(() => ErpInvoice, (invoice) => invoice.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: ErpInvoice;

  @ManyToOne(() => ErpAttachment, (attachment) => attachment.invoiceLinks, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'attachment_id' })
  attachment: ErpAttachment;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
