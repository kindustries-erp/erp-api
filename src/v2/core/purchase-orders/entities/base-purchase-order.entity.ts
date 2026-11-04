import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base Entity cho header Đơn mua hàng (lõi PO v2).
 * KHÔNG gắn @Entity(): module con khai báo bảng riêng (erp_purchase_orders,
 * erp_garage_purchase_orders). Các cột bên dưới khớp 1-1 13 cột của
 * erp_purchase_orders đã kiểm tra trên DB. Lớp con thêm cột riêng nếu cần.
 */
export abstract class BasePurchaseOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'po_no' })
  poNo: string;

  @Index()
  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @Index()
  @Column({ type: 'timestamptz', name: 'order_date' })
  orderDate: Date;

  @Column({ type: 'timestamptz', name: 'expected_date', nullable: true })
  expectedDate: Date | null;

  /** Giá trị hợp lệ do state machine của lõi quyết định (xem contracts). */
  @Index()
  @Column({ type: 'varchar', length: 255, name: 'status', default: 'DRAFT' })
  status: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'payment_status',
    default: 'UNPAID',
  })
  paymentStatus: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    name: 'supplier_invoice_no',
    nullable: true,
  })
  supplierInvoiceNo: string | null;

  /** Lấy từ JWT (req.user.sub), không nhận từ body. */
  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Index()
  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
