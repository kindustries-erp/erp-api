import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload } from '@/v2/core/notifications-core';
import { NotificationInboxCommandService } from './notification-inbox-command.service';

/**
 * Điểm gọi cho module khác (producer). Lỗi ghi thông báo chỉ được log,
 * không làm hỏng luồng nghiệp vụ đang gọi (đúng hành vi v1).
 */
@Injectable()
export class NotificationsPublisherService {
  private readonly logger = new Logger(NotificationsPublisherService.name);

  constructor(private readonly command: NotificationInboxCommandService) {}

  async createForUser(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    await this.createForUsers([userId], payload);
  }

  async createForUsers(
    userIds: string[],
    payload: NotificationPayload,
  ): Promise<void> {
    try {
      await this.command.createForUsers(userIds, payload);
    } catch (err) {
      this.logger.error(
        `Ghi thông báo thất bại (${userIds.length} user): ${payload.title}`,
        err as Error,
      );
    }
  }
}
