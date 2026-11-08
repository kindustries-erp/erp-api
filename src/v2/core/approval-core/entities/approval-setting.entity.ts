import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Khóa bật/tắt tính năng duyệt theo từng họ chứng từ (docType).
 * Không có dòng → coi như bật (hành vi cũ).
 */
@Entity({ name: 'erp_approval_settings' })
export class ApprovalSetting {
  /** Ví dụ: GARAGE_PROCUREMENT_REQUEST, GARAGE_PROCUREMENT_ORDER. */
  @PrimaryColumn({ type: 'varchar', length: 64, name: 'doc_type' })
  docType: string;

  @Column({
    type: 'boolean',
    name: 'approval_enabled',
    default: true,
  })
  approvalEnabled: boolean;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
