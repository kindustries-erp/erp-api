import { Column, Index } from 'typeorm';
import { BaseApprovalFields } from '../../approval-core/entities/base-approval-fields';

/**
 * Header Đơn mua hàng (lõi PO mới, không kế thừa PO v1).
 * Kế thừa id, extraData, timestamps, isDeleted, status, createdBy từ lớp header chung.
 * Duyệt (`status`) và giao nhận (`fulfillment_status`) là hai trục tách biệt.
 */
export abstract class BaseProcurementOrderEntity extends BaseApprovalFields {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'order_no' })
  orderNo: string;

  @Column({ type: 'date', name: 'order_date' })
  orderDate: string;

  @Column({ type: 'date', name: 'expected_date', nullable: true })
  expectedDate: string | null;

  @Index()
  @Column({ type: 'uuid', name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'supplier_name',
    nullable: true,
  })
  supplierName: string | null;

  /** DIRECT (tạo tay) | REQUEST (sinh từ PR đã duyệt). */
  @Column({
    type: 'varchar',
    length: 16,
    name: 'source_type',
    default: 'DIRECT',
  })
  sourceType: 'DIRECT' | 'REQUEST';

  /** Khóa PR đã duyệt; null khi source_type = DIRECT. */
  @Index()
  @Column({ type: 'uuid', name: 'request_id', nullable: true })
  requestId: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    name: 'fulfillment_status',
    default: 'NONE',
  })
  fulfillmentStatus: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  /** Chốt lúc duyệt; sau đó không đổi. */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'approved_total',
    nullable: true,
  })
  approvedTotal: string | null;

  @Column({ type: 'uuid', name: 'issued_by', nullable: true })
  issuedBy: string | null;

  @Column({ type: 'timestamptz', name: 'issued_at', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'uuid', name: 'cancelled_by', nullable: true })
  cancelledBy: string | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'text', name: 'cancel_reason', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'uuid', name: 'closed_by', nullable: true })
  closedBy: string | null;

  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @Column({ type: 'text', name: 'close_reason', nullable: true })
  closeReason: string | null;

  /** Chứng từ gốc khi đơn này được nhân bản từ đơn đã từ chối/hủy. */
  @Column({ type: 'uuid', name: 'cloned_from_id', nullable: true })
  clonedFromId: string | null;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;
}
