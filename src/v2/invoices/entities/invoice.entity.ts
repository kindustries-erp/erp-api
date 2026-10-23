import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entity v2 trỏ cùng bảng `erp_invoices` với `ErpInvoice` (v1).
 * `synchronize` đang tắt, nên entity này chỉ phản ánh cột thật, không sửa schema.
 * Cột phải khớp DB: `invoice_date` là `date`, `vat_rate` là numeric(9,4).
 */
@Entity({ name: 'erp_invoices' })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Chi nhánh ---
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({
    type: 'uuid',
    array: true,
    name: 'branch_ids',
    default: () => "'{}'",
  })
  branchIds: string[];

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  // --- Định danh hóa đơn ---
  @Column({ type: 'varchar', length: 128, name: 'invoice_no' })
  invoiceNo: string;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'invoice_no_normalized',
    nullable: true,
    insert: false,
    update: false,
  })
  invoiceNoNormalized: string | null;

  @Column({ type: 'varchar', length: 64, name: 'serial_no', nullable: true })
  serialNo: string | null;

  @Column({ type: 'date', name: 'invoice_date' })
  invoiceDate: string;

  @Column({ type: 'varchar', length: 16, name: 'direction', default: 'IN' })
  direction: string;

  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  @Column({ type: 'boolean', name: 'is_valid', default: false })
  isValid: boolean;

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
    type: 'varchar',
    length: 255,
    name: 'invoice_type',
    nullable: true,
  })
  invoiceType: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'invoice_category',
    nullable: true,
  })
  invoiceCategory: string | null;

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

  // --- Metadata & file ---
  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

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

  @Column({
    type: 'varchar',
    length: 20,
    name: 'posting_status',
    default: 'UNPOSTED',
  })
  postingStatus: string;

  @Column({ type: 'jsonb', name: 'effective_data', nullable: true })
  effectiveData: Record<string, unknown> | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
