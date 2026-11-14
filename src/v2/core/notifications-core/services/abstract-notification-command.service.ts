import { NotFoundException } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { BaseNotificationEntity } from '../entities/base-notification.entity';
import type { NotificationPayload } from '../types/notification.types';

export const PURGE_BATCH_SIZE = 1000;

/**
 * Ghi, đánh dấu đọc, xóa mềm và xóa cứng thông báo nền.
 * Module cụ thể kế thừa và truyền `Repository<T>` của entity mình.
 */
export abstract class AbstractNotificationCommandService<
  T extends BaseNotificationEntity,
> {
  protected constructor(protected readonly repo: Repository<T>) {}

  /** Ghi một dòng cho mỗi user (bỏ trùng). Trả số dòng đã ghi. */
  async createForUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<number> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return 0;

    const rows = unique.map((userId) =>
      this.repo.create({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type ?? 'INFO',
        isRead: false,
        readAt: null,
        targetModule: payload.target?.module ?? null,
        targetId: payload.target?.id ?? null,
        action: payload.target?.action ?? null,
        extraData: payload.extraData ?? {},
      } as DeepPartial<T>),
    );
    await this.repo.save(rows);
    return rows.length;
  }

  /** Đánh dấu đã đọc. Id không thuộc user hoặc đã xóa ⇒ 404 (không lộ sự tồn tại). */
  async markRead(id: string, userId: string): Promise<void> {
    const result = await this.repo.update(
      this.ownedWhere(id, userId),
      this.readPatch(),
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isDeleted: false, isRead: false } as FindOptionsWhere<T>,
      this.readPatch(),
    );
    return result.affected ?? 0;
  }

  /** Xóa mềm một thông báo của chính user. */
  async softDelete(id: string, userId: string): Promise<void> {
    const result = await this.repo.update(
      this.ownedWhere(id, userId),
      this.deletePatch(),
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
  }

  async softDeleteAll(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isDeleted: false } as FindOptionsWhere<T>,
      this.deletePatch(),
    );
    return result.affected ?? 0;
  }

  /**
   * Xóa cứng theo lô các dòng đã xóa mềm và không được cập nhật từ trước `cutoff`.
   * `updated_at` được TypeORM ghi lại khi xóa mềm, nên đây là mốc xóa mềm.
   * Dòng chưa xóa mềm không bị đụng tới. Trả tổng số dòng đã xóa.
   * Tên bảng lấy từ metadata của entity, không hard-code.
   */
  async purgeSoftDeletedBefore(
    cutoff: Date,
    batchSize = PURGE_BATCH_SIZE,
  ): Promise<number> {
    const table = this.repo.metadata.tableName;
    let total = 0;
    for (;;) {
      const result = await this.repo
        .createQueryBuilder()
        .delete()
        .from(this.repo.target)
        .where(
          `id IN (SELECT id FROM "${table}" WHERE is_deleted = true AND updated_at < :cutoff LIMIT :limit)`,
          { cutoff, limit: batchSize },
        )
        .execute();
      const affected = result.affected ?? 0;
      total += affected;
      if (affected < batchSize) return total;
    }
  }

  private readPatch(): QueryDeepPartialEntity<T> {
    // Cast qua unknown: T là generic nên TS không so khớp được với từng cột cụ thể.
    return {
      isRead: true,
      readAt: new Date(),
    } as unknown as QueryDeepPartialEntity<T>;
  }

  private deletePatch(): QueryDeepPartialEntity<T> {
    return { isDeleted: true } as unknown as QueryDeepPartialEntity<T>;
  }

  private ownedWhere(id: string, userId: string): FindOptionsWhere<T> {
    return { id, userId, isDeleted: false } as FindOptionsWhere<T>;
  }
}
