import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sinvoice_drafts' })
export class SinvoiceDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 64, name: 'document_no', nullable: true })
  documentNo: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'supplier_tax_code',
    nullable: true,
  })
  supplierTaxCode: string | null;

  // --- Bên mua ---
  @Column({ type: 'varchar', length: 255, name: 'buyer_name', nullable: true })
  buyerName: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'buyer_tax_code',
    nullable: true,
  })
  buyerTaxCode: string | null;

  @Column({ type: 'text', name: 'buyer_address', nullable: true })
  buyerAddress: string | null;

  @Column({ type: 'varchar', length: 255, name: 'buyer_email', nullable: true })
  buyerEmail: string | null;

  // --- Tài chính ---
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'vat_amount',
    default: 0,
  })
  vatAmount: string;

  @Column({
    type: 'varchar',
    length: 8,
    name: 'currency_code',
    nullable: true,
    default: 'VND',
  })
  currencyCode: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  // --- Trạng thái ---
  @Index()
  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  // --- Payload lưu trữ ---
  @Column({ type: 'jsonb', name: 'lines', nullable: true })
  lines: any[] | null;

  @Column({ type: 'jsonb', name: 'request_payload', nullable: true })
  requestPayload: any | null;

  @Column({ type: 'jsonb', name: 'response_payload', nullable: true })
  responsePayload: any | null;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
