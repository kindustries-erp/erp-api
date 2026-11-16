import { Entity, Index } from 'typeorm';
import { BaseFileAttachmentEntity } from '@/v2/core/file-attachments-core';

/**
 * File đính kèm đa owner (bảng `file_attachments`). Nguồn sự thật duy nhất cho file
 * của hóa đơn (và Garage PR về sau). Xóa mềm bằng `is_deleted`; xóa cứng qua purge service.
 */
@Entity({ name: 'file_attachments' })
@Index('IDX_file_attachments_owner_active', ['ownerType', 'ownerId'], {
  where: '"is_deleted" = false',
})
@Index('IDX_file_attachments_deleted', ['isDeleted', 'deletedAt'])
@Index('IDX_file_attachments_file_key', ['fileKey'])
@Index(
  'UQ_file_attachments_owner_key_active',
  ['ownerType', 'ownerId', 'fileKey'],
  {
    unique: true,
    where: '"is_deleted" = false',
  },
)
export class FileAttachment extends BaseFileAttachmentEntity {}
