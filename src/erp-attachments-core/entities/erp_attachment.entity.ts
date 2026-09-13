import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ErpInvoiceAttachment } from '../../erp-invoices-core/entities/erp_invoice_attachment.entity';

export enum DocumentType {
  HOP_DONG = 'HOP_DONG',
  HOA_DON = 'HOA_DON',
  BANG_KE = 'BANG_KE',
  KHAC = 'KHAC',
}

@Entity({ name: 'erp_attachments' })
export class ErpAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  @Column({ type: 'varchar', length: 512, name: 'file_key' })
  fileKey: string;

  @Column({ type: 'int', name: 'file_size', default: 0 })
  fileSize: number;

  @Column({ type: 'varchar', length: 128, name: 'mime_type', nullable: true })
  mimeType: string | null;

  @Column({
    type: 'enum',
    enum: DocumentType,
    name: 'document_type',
    default: DocumentType.KHAC,
  })
  documentType: string;

  @Column({ type: 'varchar', length: 128, name: 'module', nullable: true })
  module: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    () => ErpInvoiceAttachment,
    (link: ErpInvoiceAttachment) => link.attachment,
  )
  invoiceLinks: ErpInvoiceAttachment[];
}
