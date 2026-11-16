import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import { FileAttachment } from '../entities/file-attachment.entity';
import { FileKeyReferenceChecker } from './file-key-reference.checker';
import { FileStorageGateway } from './file-storage.gateway';

export const MAX_PURGE_BATCH = 100;

export type PurgeSkipReason =
  | 'NOT_FOUND'
  | 'NOT_SOFT_DELETED'
  | 'STORAGE_ERROR';

export interface PurgedItem {
  id: string;
  /** true: object R2 đã bị xóa (không còn tham chiếu nào khác). */
  objectDeleted: boolean;
  /** true: giữ object vì còn nơi khác tham chiếu khóa này. */
  objectKept: boolean;
  remainingReferences: number;
}

export interface SkippedItem {
  id: string;
  reason: PurgeSkipReason;
}

export interface PurgeResult {
  purged: PurgedItem[];
  skipped: SkippedItem[];
}

export interface PurgeActor {
  userId: string | null;
  /** `MANUAL`: người dùng bấm xóa vĩnh viễn. `JOB`: tự động dọn. */
  source: 'MANUAL' | 'JOB';
}

/**
 * Xóa cứng file đã xóa mềm. Mỗi file một transaction, khóa theo `file_key` để không đua
 * với việc đăng ký file trùng khóa. Chỉ xóa object R2 khi không còn tham chiếu nào khác.
 */
@Injectable()
export class FileAttachmentPurgeService {
  private readonly logger = new Logger(FileAttachmentPurgeService.name);

  constructor(
    @InjectRepository(FileAttachment)
    private readonly repo: Repository<FileAttachment>,
    private readonly gateway: FileStorageGateway,
    private readonly references: FileKeyReferenceChecker,
    private readonly audit: AuditWriterService,
  ) {}

  async purge(ids: string[], actor: PurgeActor): Promise<PurgeResult> {
    const unique = [...new Set(ids)];
    if (unique.length > MAX_PURGE_BATCH) {
      throw new BadRequestException(`Tối đa ${MAX_PURGE_BATCH} file mỗi lần`);
    }
    const result: PurgeResult = { purged: [], skipped: [] };
    for (const id of unique) {
      const outcome = await this.purgeOne(id);
      if ('reason' in outcome) result.skipped.push(outcome);
      else {
        result.purged.push(outcome.item);
        await this.record(outcome.row, outcome.item, actor);
      }
    }
    return result;
  }

  private async purgeOne(
    id: string,
  ): Promise<SkippedItem | { item: PurgedItem; row: FileAttachment }> {
    return this.repo.manager.transaction(async (m) => {
      const row = await m.findOne(FileAttachment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) return { id, reason: 'NOT_FOUND' as const };
      if (!row.isDeleted) return { id, reason: 'NOT_SOFT_DELETED' as const };

      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        row.fileKey,
      ]);
      const refs = await this.references.count(row.fileKey, row.id);

      let objectDeleted = false;
      if (refs.total === 0) {
        try {
          await this.gateway.delete(row.fileKey);
          objectDeleted = true;
        } catch {
          this.logger.warn(`Giữ dòng ${id}: không xóa được object R2`);
          return { id, reason: 'STORAGE_ERROR' as const };
        }
      }
      await m.delete(FileAttachment, { id });
      return {
        row,
        item: {
          id,
          objectDeleted,
          objectKept: !objectDeleted,
          remainingReferences: refs.total,
        },
      };
    });
  }

  private async record(
    row: FileAttachment,
    item: PurgedItem,
    actor: PurgeActor,
  ): Promise<void> {
    await this.audit.recordAction({
      actorUserId: actor.userId ?? undefined,
      actionType: 'PURGE',
      module: 'file-attachments',
      entityType: 'file_attachments',
      entityId: row.id,
      message: item.objectDeleted
        ? `Xóa vĩnh viễn file và object (${actor.source})`
        : `Xóa vĩnh viễn dòng, giữ object do còn ${item.remainingReferences} tham chiếu (${actor.source})`,
      beforeSnapshot: {
        ownerType: row.ownerType,
        ownerId: row.ownerId,
        fileName: row.fileName,
        origin: row.origin,
      },
      afterSnapshot: {
        objectDeleted: item.objectDeleted,
        remainingReferences: item.remainingReferences,
      },
    });
  }
}
