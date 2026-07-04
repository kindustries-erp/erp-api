import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_sales_orders' })
export class ErpSalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'so_no' })
  soNo: string;

  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId: string | null;

  @Column({ type: 'date', name: 'order_date' })
  orderDate: string;

  @Column({ type: 'date', name: 'expected_delivery_date', nullable: true })
  expectedDeliveryDate: string | null;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
