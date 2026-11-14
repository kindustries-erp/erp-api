import { Injectable } from '@nestjs/common';
import { NotificationInboxCommandService } from './services/notification-inbox-command.service';
import { NotificationInboxQueryService } from './services/notification-inbox-query.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import {
  NotificationActionResponseDto,
  NotificationAffectedDto,
  NotificationListResponseDto,
} from './dto/notification-response.dto';
import { toNotificationResponse } from './helpers/notification.mapper';
import { toPagedList } from '@/common/utils/paginated-result';

/** Facade HTTP: gọi lõi, map sang response DTO. Mọi thao tác đều nhận userId từ token. */
@Injectable()
export class NotificationsInboxService {
  constructor(
    private readonly query: NotificationInboxQueryService,
    private readonly command: NotificationInboxCommandService,
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
    return toPagedList(
      items.map(toNotificationResponse),
      page,
      pageSize,
      total,
      { unreadCount },
    );
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
