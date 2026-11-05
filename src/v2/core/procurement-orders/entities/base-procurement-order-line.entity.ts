import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Dòng Đơn mua hàng (lõi PO mới). `line_type` bắt buộc.
 * `qty_fulfilled` chỉ được ghi bởi cổng giao nhận (GOODS) hoặc nghiệm thu (SERVICE).
 */
export abstract class BaseProcurementOrderLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'varchar', length: 16, name: 'line_type' })
  lineType: 'GOODS' | 'SERVICE';

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
    name: 'qty_fulfilled',
    default: 0,
  })
  qtyFulfilled: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'unit_price',
    nullable: true,
  })
  unitPrice: string | null;

  /** Server tính = qty_ordered × unit_price. */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'amount',
    nullable: true,
  })
  amount: string | null;

  /** Dòng PR nguồn; null khi PO tạo tay. */
  @Index()
  @Column({ type: 'uuid', name: 'request_line_id', nullable: true })
  requestLineId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
