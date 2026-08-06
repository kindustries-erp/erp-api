import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_goods_receipt_lines' })
export class ErpGoodsReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'goods_receipt_id' })
  goodsReceiptId: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'purchase_order_line_id', nullable: true })
  purchaseOrderLineId: string | null;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'jsonb', name: 'returned_serial_ids', nullable: true })
  returnedSerialIds: string[] | null;

  @Column({ type: 'boolean', name: 'serials_generated', default: false })
  serialsGenerated: boolean;

  @Column({
    type: 'numeric',
    name: 'qty_received',
    precision: 18,
    scale: 3,
    default: 0,
  })
  qtyReceived: string;

  @Column({
    type: 'numeric',
    name: 'unit_cost',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  unitCost: string | null;

  @Column({
    type: 'numeric',
    name: 'amount',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  amount: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
