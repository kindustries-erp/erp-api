import { Column } from 'typeorm';
import { CoreHeaderEntity } from '../../base-core/entities/core-header.entity';

/**
 * Cột duyệt dùng chung cho chứng từ có vòng đời duyệt (PR, PO).
 * Kế thừa lớp header chung (id, extraData, timestamps, isDeleted, status, createdBy).
 * Mọi cột duyệt đều nullable: chứng từ chưa đi tới bước đó thì để trống.
 * Người thực hiện luôn lấy từ JWT (req.user.sub), không nhận từ body.
 */
export abstract class BaseApprovalFields extends CoreHeaderEntity {
  @Column({ type: 'uuid', name: 'submitted_by', nullable: true })
  submittedBy: string | null;

  @Column({ type: 'timestamptz', name: 'submitted_at', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamptz', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', name: 'rejected_by', nullable: true })
  rejectedBy: string | null;

  @Column({ type: 'timestamptz', name: 'rejected_at', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', name: 'reject_reason', nullable: true })
  rejectReason: string | null;

  /** Người duyệt được chỉ định lúc gửi duyệt. Chỉ có ý nghĩa khi khóa duyệt đang bật. */
  @Column({ type: 'uuid', name: 'approver_id', nullable: true })
  approverId: string | null;
}
