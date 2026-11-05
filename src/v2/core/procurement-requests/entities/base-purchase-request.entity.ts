import {
  Column,
  CreateDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseApprovalFields } from '../../approval/entities/base-approval-fields';

/**
 * Header Đề nghị mua (lõi PR v2). Không gắn @Entity: module con khai báo bảng.
 * Vòng đời `status` và tiến độ `ordering_status` là hai trục tách biệt.
 */
export abstract class BasePurchaseRequestEntity extends BaseApprovalFields {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'request_no' })
  requestNo: string;

  @Column({ type: 'date', name: 'request_date' })
  requestDate: string;

  @Column({ type: 'date', name: 'needed_date', nullable: true })
  neededDate: string | null;

  @Column({ type: 'varchar', length: 255, name: 'title', nullable: true })
  title: string | null;

  @Column({ type: 'uuid', name: 'requester_employee_id', nullable: true })
  requesterEmployeeId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, name: 'status', default: 'DRAFT' })
  status: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    name: 'ordering_status',
    default: 'NONE',
  })
  orderingStatus: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'estimated_total',
    default: 0,
  })
  estimatedTotal: string;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'cancelled_by', nullable: true })
  cancelledBy: string | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', name: 'cancel_reason', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'text', name: 'close_reason', nullable: true })
  closeReason: string | null;

  /** Lấy từ JWT (req.user.sub), không nhận từ body. */
  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Index()
  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
