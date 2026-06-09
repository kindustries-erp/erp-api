import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpPurchaseOrder } from './erp_purchase_order.entity';

@Entity({ name: 'erp_purchase_order_lines' })
export class ErpPurchaseOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => ErpPurchaseOrder, (po) => po.lines)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: ErpPurchaseOrder;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', name: 'qty_ordered', precision: 18, scale: 3 })
  qtyOrdered: string;

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
    name: 'unit_price',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  unitPrice: string | null;

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
