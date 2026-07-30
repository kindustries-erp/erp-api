import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ErpInvoiceItem } from './erp_invoice_item.entity';
import { ErpInvoiceVoucherNetOff } from './erp_invoice_voucher_netoff.entity';
import { ErpInvoiceAttachment } from './erp_invoice_attachment.entity';

@Entity({ name: 'erp_invoices' })
export class ErpInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

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

  @Index()
  @Column({ type: 'varchar', length: 16, name: 'direction', default: 'IN' })
  direction: string; // IN | OUT

  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  @Column({ type: 'varchar', length: 64, name: 'source', nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 255, name: 'external_id', nullable: true })
  externalId: string | null;

  @Column({ type: 'int', name: 'tax_invoice_status', nullable: true })
  taxInvoiceStatus: number | null;

  @Column({ type: 'int', name: 'tax_process_status', nullable: true })
  taxProcessStatus: number | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'tax_invoice_type',
    nullable: true,
  })
  taxInvoiceType: string | null;

  @Column({ type: 'boolean', name: 'is_valid', default: false })
  isValid: boolean;

  @Column({ type: 'timestamptz', name: 'validated_at', nullable: true })
  validatedAt: Date | null;

  @Column({ type: 'uuid', name: 'validated_by', nullable: true })
  validatedBy: string | null;

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
    length: 255,
    name: 'buyer_personal_name',
    nullable: true,
  })
  buyerPersonalName: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'buyer_cccd',
    nullable: true,
  })
  buyerCccd: string | null;

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

  @Column({
    type: 'varchar',
    length: 500,
    name: 'payment_document_nos',
    nullable: true,
  })
  paymentDocumentNos: string | null;

  // --- Metadata ---
  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  // --- Trích xuất tự động ---
  @Column({
    type: 'varchar',
    length: 50,
    name: 'license_plate',
    nullable: true,
  })
  licensePlate: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'settlement_order',
    nullable: true,
  })
  settlementOrder: string | null;

  // --- R2 Storage ---
  @Column({
    type: 'varchar',
    length: 512,
    name: 'pdf_file_key',
    nullable: true,
  })
  pdfFileKey: string | null;

  @Column({ type: 'jsonb', name: 'pdf_files', nullable: true })
  pdfFiles: any[] | null;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'xml_file_key',
    nullable: true,
  })
  xmlFileKey: string | null;

  @Column({ type: 'uuid', name: 'xml_import_id', nullable: true })
  xmlImportId: string | null;

  // --- Hạch toán kế toán ---
  @Column({
    type: 'varchar',
    length: 20,
    name: 'posting_status',
    default: 'UNPOSTED',
  })
  postingStatus: string;

  @Column({ type: 'date', name: 'posting_date', nullable: true })
  postingDate: string | null;

  @Column({ type: 'uuid', name: 'journal_entry_id', nullable: true })
  journalEntryId: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ErpInvoiceItem, (item) => item.invoice, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  items: ErpInvoiceItem[];

  @OneToMany('ErpInvoiceVoucherNetOff', (netOff: any) => netOff.invoice)
  voucherNetOffs: ErpInvoiceVoucherNetOff[];

  @OneToMany(() => ErpInvoiceAttachment, (attachment) => attachment.invoice, {
    cascade: true,
  })
  attachments: ErpInvoiceAttachment[];
}
