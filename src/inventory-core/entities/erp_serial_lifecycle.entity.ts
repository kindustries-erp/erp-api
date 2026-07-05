import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_serial_lifecycles' })
export class ErpSerialLifecycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'serial_id' })
  serialId: string;

  @Column({ type: 'uuid', name: 'sales_order_id', nullable: true })
  salesOrderId: string | null;

  @Column({ type: 'uuid', name: 'goods_issue_id', nullable: true })
  goodsIssueId: string | null;

  @Column({ type: 'uuid', name: 'dealer_id', nullable: true })
  dealerId: string | null;

  @Column({ type: 'date', name: 'delivery_date', nullable: true })
  deliveryDate: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_name',
    nullable: true,
  })
  customerName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_phone',
    nullable: true,
  })
  customerPhone: string | null;

  @Column({ type: 'text', name: 'customer_address', nullable: true })
  customerAddress: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'customer_id_number',
    nullable: true,
  })
  customerIdNumber: string | null;

  @Column({
    type: 'timestamptz',
    name: 'warranty_activated_at',
    nullable: true,
  })
  warrantyActivatedAt: Date | null;

  @Column({ type: 'int', name: 'warranty_months', nullable: true })
  warrantyMonths: number | null;

  @Column({ type: 'date', name: 'warranty_end_date', nullable: true })
  warrantyEndDate: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'activation_source',
    nullable: true,
  })
  activationSource: string | null;

  @Column({ type: 'varchar', length: 50, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', name: 'attributes', nullable: true })
  attributes: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
