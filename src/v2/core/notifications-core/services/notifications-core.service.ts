import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload } from '../types/notification.types';
import { NotificationCommandService } from './notification-command.service';

/**
 * Điểm gọi cho module khác (producer). Lỗi ghi thông báo chỉ được log,
 * không làm hỏng luồng nghiệp vụ đang gọi (đúng hành vi v1).
 */
@Injectable()
export class NotificationsCoreService {
  private readonly logger = new Logger(NotificationsCoreService.name);

  constructor(private readonly command: NotificationCommandService) {}

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
