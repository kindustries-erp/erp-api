import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_inventory_serials' })
export class ErpInventorySerial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'serial_no' })
  serialNo: string;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'status',
    default: 'IN_STOCK',
  })
  status: string;

  @Column({ type: 'uuid', name: 'vin_id', nullable: true })
  vinId: string | null;

  @Column({ type: 'uuid', name: 'receipt_line_id', nullable: true })
  receiptLineId: string | null;

  @Column({ type: 'uuid', name: 'sales_order_line_id', nullable: true })
  salesOrderLineId: string | null;

  @Column({ type: 'uuid', name: 'goods_issue_line_id', nullable: true })
  goodsIssueLineId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
