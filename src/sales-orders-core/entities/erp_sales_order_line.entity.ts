import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_sales_order_lines' })
export class ErpSalesOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ type: 'int', name: 'line_no' })
  lineNo: number;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'numeric', name: 'qty_ordered', precision: 18, scale: 3 })
  qtyOrdered: string;

  @Column({
    type: 'numeric',
    name: 'qty_reserved',
    precision: 18,
    scale: 3,
    default: 0,
  })
  qtyReserved: string;

  @Column({
    type: 'numeric',
    name: 'qty_delivered',
    precision: 18,
    scale: 3,
    default: 0,
  })
  qtyDelivered: string;

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
