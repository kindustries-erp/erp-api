import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CoreNotification,
  NotificationType,
} from './entities/core-notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(CoreNotification)
    private readonly repository: Repository<CoreNotification>,
  ) {}

  async createForUser(
    userId: string,
    payload: {
      title: string;
      message: string;
      type?: NotificationType;
      metadata?: any;
    },
  ) {
    try {
      const notif = this.repository.create({
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type || 'INFO',
        metadata: payload.metadata,
      });
      await this.repository.save(notif);
    } catch (err) {
      this.logger.error(
        `Failed to create notification for user ${userId}`,
        err,
      );
    }
  }

  async findAllForUser(userId: string): Promise<CoreNotification[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.repository.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.update({ userId, isRead: false }, { isRead: true });
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await this.repository.delete({ id, userId });
  }
}
