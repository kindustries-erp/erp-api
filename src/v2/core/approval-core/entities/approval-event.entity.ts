import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Nhật ký mọi bước chuyển trạng thái của chứng từ duyệt (PR, PO).
 * Bảng chỉ ghi thêm, không sửa, không xóa.
 */
@Entity({ name: 'erp_approval_events' })
@Index('IDX_erp_approval_events_doc', ['docType', 'docId', 'createdAt'])
export class ApprovalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Mã họ chứng từ, ví dụ: PROCUREMENT_REQUEST, PROCUREMENT_ORDER. */
  @Column({ type: 'varchar', length: 64, name: 'doc_type' })
  docType: string;

  @Column({ type: 'uuid', name: 'doc_id' })
  docId: string;

  /** submit | recall | approve | reject | cancel | close | issue */
  @Column({ type: 'varchar', length: 32, name: 'action' })
  action: string;

  @Column({ type: 'varchar', length: 64, name: 'from_status' })
  fromStatus: string;

  @Column({ type: 'varchar', length: 64, name: 'to_status' })
  toStatus: string;

  @Column({ type: 'uuid', name: 'actor_id' })
  actorId: string;

  /** Tên role của người thực hiện tại thời điểm thao tác (không đổi sau này). */
  @Column({
    type: 'text',
    array: true,
    name: 'actor_roles',
    default: () => "'{}'",
  })
  actorRoles: string[];

  @Column({ type: 'text', name: 'comment', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
