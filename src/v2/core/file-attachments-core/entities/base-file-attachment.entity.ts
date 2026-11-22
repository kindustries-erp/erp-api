import { Column } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';
import type {
  FileCategory,
  FileOrigin,
  FileOwnerType,
} from '../types/file-owner.types';

/**
 * Lớp nền file đính kèm đa owner (abstract, không `@Entity`). Module cụ thể
 * (`file-attachments`) kế thừa và khai báo `@Entity` + `@Index`.
 * `owner_id` không có FK cứng: owner policy xác minh chứng từ tồn tại.
 */
export abstract class BaseFileAttachmentEntity extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 64, name: 'owner_type' })
  ownerType: FileOwnerType;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'varchar', length: 32, default: 'KHAC' })
  category: FileCategory;

  @Column({ type: 'boolean', name: 'is_original', default: false })
  isOriginal: boolean;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  /** Khóa object trên R2. Do server sinh (hoặc khóa legacy của V1), không nhận từ client. */
  @Column({ type: 'varchar', length: 512, name: 'file_key' })
  fileKey: string;

  @Column({ type: 'varchar', length: 16, default: 'V2' })
  origin: FileOrigin;

  /** Nguồn legacy, vd. `erp_invoices.pdf_file_key` hoặc `erp_attachments:<id>`. */
  @Column({
    type: 'varchar',
    length: 96,
    name: 'legacy_source',
    nullable: true,
  })
  legacySource: string | null;

  @Column({ type: 'bigint', name: 'file_size', default: 0 })
  fileSize: string;

  @Column({ type: 'varchar', length: 128, name: 'mime_type', nullable: true })
  mimeType: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'checksum_sha256',
    nullable: true,
  })
  checksumSha256: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'uuid', name: 'deleted_by', nullable: true })
  deletedBy: string | null;
}
