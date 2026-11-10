import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbstractNotificationCommandService } from '@/v2/core/notifications-core';
import { NotificationInbox } from '../entities/notification-inbox.entity';

@Injectable()
export class NotificationInboxCommandService extends AbstractNotificationCommandService<NotificationInbox> {
  constructor(
    @InjectRepository(NotificationInbox)
    repo: Repository<NotificationInbox>,
  ) {
    super(repo);
  }
}
