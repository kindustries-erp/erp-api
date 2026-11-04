import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base Entity cho dòng hàng của Đơn mua hàng (lõi PO v2).
 * Cột khóa ngoại tới header KHÔNG nằm ở đây: lớp con khai báo
 * (purchase_order_id cho core, garage_purchase_order_id cho garage),
 * nên một base dùng được cho cả hai bảng. Tổng cộng 13 cột khi ghép với FK.
 */
export abstract class BasePurchaseOrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Index()
  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', length: 128, name: 'item_code', nullable: true })
  itemCode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'item_name', nullable: true })
  itemName: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_ordered' })
  qtyOrdered: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_received',
    default: 0,
  })
  qtyReceived: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'unit_price',
    nullable: true,
  })
  unitPrice: string | null;

  /** Luôn được tính lại ở server = qty_ordered × unit_price (xem engine). */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'amount',
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
