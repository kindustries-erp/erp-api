import type { FileAttachment } from '../entities/file-attachment.entity';
import type { FileAttachmentResponseDto } from '../dto/file-attachment-response.dto';

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toFileAttachmentResponse(
  row: FileAttachment,
): FileAttachmentResponseDto {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    category: row.category,
    isOriginal: row.isOriginal,
    fileName: row.fileName,
    fileSize: Number(row.fileSize),
    mimeType: row.mimeType,
    origin: row.origin,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    isDeleted: row.isDeleted,
    deletedAt: iso(row.deletedAt),
    deletedBy: row.deletedBy,
  };
}
