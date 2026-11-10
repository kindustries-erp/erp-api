import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CoreBaseEntity } from '../../base-core/entities/core-base.entity';
import { IInvoiceHeader } from '../contracts/invoice.contract';

/**
 * Abstract Base Entity cho bảng Header hóa đơn.
 * KHÔNG gắn @Entity() ở đây để các module con tự định nghĩa tên bảng riêng biệt.
 * Chỉ kế thừa id và extraData. Timestamp giữ kiểu `timestamp` của bảng cũ
 * (không đổi kiểu cột DB): TypeORM ưu tiên cột lớp cha nên không thể override ở đây.
 */
export abstract class BaseInvoiceEntity
  extends CoreBaseEntity
  implements IInvoiceHeader
{
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
  })
  invoiceNoNormalized: string | null;

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

  @Column({
    type: 'varchar',
    length: 128,
    name: 'related_invoice_no',
    nullable: true,
  })
  relatedInvoiceNo: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'related_serial_no',
    nullable: true,
  })
  relatedSerialNo: string | null;

  @Column({ type: 'int', name: 'tax_invoice_status', nullable: true })
  taxInvoiceStatus: number | null;

  @Column({ type: 'int', name: 'tax_process_status', nullable: true })
  taxProcessStatus: number | null;

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

  @Column({ type: 'varchar', length: 255, name: 'seller_bank', nullable: true })
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

  @Column({ type: 'varchar', length: 64, name: 'buyer_cccd', nullable: true })
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

  // --- Metadata & file ---
  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

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
