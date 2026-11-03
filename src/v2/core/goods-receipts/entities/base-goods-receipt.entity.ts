import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  IVoucherHeader,
  IVoucherLine,
  VoucherStatus,
} from '../contracts/voucher.contract';

/**
 * Abstract Base Entity cho bảng Header chứng từ Nhập kho (Goods Receipt).
 * KHÔNG gắn @Entity() ở đây để các module con tự định nghĩa tên bảng riêng biệt.
 */
export abstract class BaseGoodsReceiptEntity implements IVoucherHeader {
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
  status: VoucherStatus | string;

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
}
