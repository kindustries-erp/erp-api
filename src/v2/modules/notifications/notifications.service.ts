import { Injectable } from '@nestjs/common';
import {
  NotificationCommandService,
  NotificationQueryService,
} from '@/v2/core/notifications-core';
import { QueryNotificationDto } from './dto/query-notification.dto';
import {
  NotificationActionResponseDto,
  NotificationAffectedDto,
  NotificationListResponseDto,
} from './dto/notification-response.dto';
import {
  toNotificationResponse,
  toPaginationMeta,
} from './helpers/notification.mapper';

/** Facade HTTP: gọi lõi, map sang response DTO. Mọi thao tác đều nhận userId từ token. */
@Injectable()
export class NotificationsV2Service {
  constructor(
    private readonly query: NotificationQueryService,
    private readonly command: NotificationCommandService,
  ) {}

  async list(
    userId: string,
    dto: QueryNotificationDto,
  ): Promise<NotificationListResponseDto> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const [{ items, total }, unreadCount] = await Promise.all([
      this.query.listForUser(userId, {
        page,
        pageSize,
        unreadOnly: dto.unreadOnly,
        type: dto.type,
      }),
      this.query.countUnread(userId),
    ]);
    return {
      items: items.map(toNotificationResponse),
      pagination: toPaginationMeta(page, pageSize, total),
      unreadCount,
    };
  }

  async unreadCount(userId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.query.countUnread(userId) };
  }

  async markRead(
    id: string,
    userId: string,
  ): Promise<NotificationActionResponseDto<null>> {
    await this.command.markRead(id, userId);
    return { message: 'Đã đánh dấu đã đọc', data: null };
  }

  async markAllRead(
    userId: string,
  ): Promise<NotificationActionResponseDto<NotificationAffectedDto>> {
    const affected = await this.command.markAllRead(userId);
    return { message: 'Đã đánh dấu tất cả đã đọc', data: { affected } };
  }

  async remove(
    id: string,
    userId: string,
  ): Promise<NotificationActionResponseDto<null>> {
    await this.command.softDelete(id, userId);
    return { message: 'Đã xóa thông báo', data: null };
  }

  async removeAll(
    userId: string,
  ): Promise<NotificationActionResponseDto<NotificationAffectedDto>> {
    const affected = await this.command.softDeleteAll(userId);
    return { message: 'Đã xóa tất cả thông báo', data: { affected } };
  }
}
