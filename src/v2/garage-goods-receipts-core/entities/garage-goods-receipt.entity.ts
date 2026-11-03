import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import type { GarageGoodsReceiptLine } from './garage-goods-receipt-line.entity';

@Entity('erp_garage_goods_receipts')
export class GarageGoodsReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, name: 'receipt_no' })
  receiptNo: string;

  @Index()
  @Column({ type: 'timestamptz', name: 'receipt_date' })
  receiptDate: Date;

  @Index()
  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'supplier_name',
    nullable: true,
  })
  supplierName?: string;

  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId?: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'branch_name',
    nullable: true,
  })
  branchName?: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'DRAFT', name: 'status' })
  status: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: 'UNPAID',
    name: 'payment_status',
  })
  paymentStatus: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks?: string;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy?: string | null;

  @Index()
  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany('GarageGoodsReceiptLine', (line: any) => line.receipt, {
    cascade: true,
  })
  lines?: Relation<GarageGoodsReceiptLine[]>;
}
