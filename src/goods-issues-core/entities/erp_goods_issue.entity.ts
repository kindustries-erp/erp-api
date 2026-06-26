import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_goods_issues' })
export class ErpGoodsIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'issue_no' })
  issueNo: string;

  @Column({ type: 'timestamptz', name: 'issue_date' })
  issueDate: Date;

  @Column({ type: 'varchar', length: 255, name: 'issue_type' })
  issueType: string;

  @Column({ type: 'uuid', name: 'customer_id', nullable: true })
  customerId: string | null;

  @Column({ type: 'uuid', name: 'sales_order_id', nullable: true })
  salesOrderId: string | null;

  @Column({ type: 'uuid', name: 'production_order_id', nullable: true })
  productionOrderId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
