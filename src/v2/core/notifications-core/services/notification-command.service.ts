import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCore } from '../entities/notification.entity';
import type { NotificationPayload } from '../types/notification.types';

@Injectable()
export class NotificationCommandService {
  constructor(
    @InjectRepository(NotificationCore)
    private readonly repo: Repository<NotificationCore>,
  ) {}

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
      }),
    );
    await this.repo.save(rows);
    return rows.length;
  }

  /** Đánh dấu đã đọc. Id không thuộc user hoặc đã xóa ⇒ 404 (không lộ sự tồn tại). */
  async markRead(id: string, userId: string): Promise<void> {
    const result = await this.repo.update(
      { id, userId, isDeleted: false },
      { isRead: true, readAt: new Date() },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isDeleted: false, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  /** Xóa mềm một thông báo của chính user. */
  async softDelete(id: string, userId: string): Promise<void> {
    const result = await this.repo.update(
      { id, userId, isDeleted: false },
      { isDeleted: true },
    );
    if (!result.affected) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
  }

  async softDeleteAll(userId: string): Promise<number> {
    const result = await this.repo.update(
      { userId, isDeleted: false },
      { isDeleted: true },
    );
    return result.affected ?? 0;
  }
}
