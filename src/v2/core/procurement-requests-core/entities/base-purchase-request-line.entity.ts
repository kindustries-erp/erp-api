import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Dòng Đề nghị mua (lõi PR v2). Cột khóa ngoại tới header nằm ở lớp con.
 * `qty_ordered` chỉ được ghi bởi cổng đặt hàng (ordering service), không sửa tay.
 */
export abstract class BasePurchaseRequestLineEntity {
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

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_requested' })
  qtyRequested: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_ordered',
    default: 0,
  })
  qtyOrdered: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'est_unit_price',
    nullable: true,
  })
  estUnitPrice: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'est_amount',
    nullable: true,
  })
  estAmount: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
