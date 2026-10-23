import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Dòng hàng hóa của hóa đơn, bảng `erp_invoice_items`.
 * Không khai relation sang `Invoice`: v2 ghi và đọc theo `invoiceId`.
 * Cột phải khớp DB (`synchronize` đang tắt).
 */
@Entity({ name: 'erp_invoice_items' })
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'invoice_id' })
  invoiceId: string;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'invoice_subcategory',
    default: 'NORMAL',
  })
  invoiceSubcategory: string;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 64, name: 'unit', nullable: true })
  unit: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'item_code',
    nullable: true,
  })
  itemCode: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'quantity',
    nullable: true,
  })
  quantity: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 4,
    name: 'unit_price',
    nullable: true,
  })
  unitPrice: string | null;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
