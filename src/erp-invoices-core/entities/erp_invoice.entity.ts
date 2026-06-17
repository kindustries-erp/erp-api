import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_invoices' })
export class ErpInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'invoice_no' })
  invoiceNo: string;

  @Column({ type: 'varchar', length: 64, name: 'serial_no', nullable: true })
  serialNo: string | null;

  @Column({ type: 'date', name: 'invoice_date' })
  invoiceDate: string;

  @Index()
  @Column({ type: 'varchar', length: 16, name: 'direction', default: 'IN' })
  direction: string; // IN | OUT

  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  // --- Bên bán ---
  @Column({ type: 'varchar', length: 255, name: 'seller_name', nullable: true })
  sellerName: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'seller_tax_code',
    nullable: true,
  })
  sellerTaxCode: string | null;

  @Column({ type: 'text', name: 'seller_address', nullable: true })
  sellerAddress: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'seller_bank',
    nullable: true,
  })
  sellerBank: string | null;

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

  // --- Tài chính ---
  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'pre_vat_amount',
    default: 0,
  })
  preVatAmount: string;

  @Column({
    type: 'numeric',
    precision: 9,
    scale: 4,
    name: 'vat_rate',
    nullable: true,
  })
  vatRate: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'vat_amount',
    default: 0,
  })
  vatAmount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'discount_amount',
    default: 0,
  })
  discountAmount: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  // --- Liên kết chứng từ ---
  @Column({ type: 'uuid', name: 'purchase_order_id', nullable: true })
  purchaseOrderId: string | null;

  @Column({ type: 'uuid', name: 'sales_order_id', nullable: true })
  salesOrderId: string | null;

  // --- Metadata ---
  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  // --- R2 Storage ---
  @Column({
    type: 'varchar',
    length: 512,
    name: 'pdf_file_key',
    nullable: true,
  })
  pdfFileKey: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'xml_file_key',
    nullable: true,
  })
  xmlFileKey: string | null;

  @Column({ type: 'uuid', name: 'xml_import_id', nullable: true })
  xmlImportId: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
