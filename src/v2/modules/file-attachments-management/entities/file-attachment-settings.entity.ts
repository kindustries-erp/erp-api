import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Id cố định của dòng cài đặt duy nhất. */
export const FILE_ATTACHMENT_SETTINGS_ID = 1;

/**
 * Cài đặt lưu giữ file toàn hệ thống (một dòng). Mặc định tắt tự động dọn;
 * `retention_days` chỉ có tác dụng khi `auto_purge_enabled = true`.
 */
@Entity({ name: 'file_attachment_settings' })
export class FileAttachmentSettings {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ type: 'boolean', name: 'auto_purge_enabled', default: false })
  autoPurgeEnabled: boolean;

  @Column({ type: 'integer', name: 'retention_days', default: 30 })
  retentionDays: number;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
