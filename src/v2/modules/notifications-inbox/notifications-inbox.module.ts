import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './controllers/notification.controller';
import { NotificationInbox } from './entities/notification-inbox.entity';
import { NotificationPurgeJob } from './jobs/notification-purge.job';
import { NotificationsInboxService } from './notifications-inbox.service';
import { NotificationInboxCommandService } from './services/notification-inbox-command.service';
import { NotificationInboxQueryService } from './services/notification-inbox-query.service';
import { NotificationsPublisherService } from './services/notifications-publisher.service';

/**
 * Module thông báo v2 (theo user, không RBAC): HTTP `/api/v2/notifications`,
 * publisher cho module khác và job xóa cứng. Bảng `notifications_inbox`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([NotificationInbox])],
  controllers: [NotificationController],
  providers: [
    NotificationInboxQueryService,
    NotificationInboxCommandService,
    NotificationsPublisherService,
    NotificationPurgeJob,
    NotificationsInboxService,
  ],
  exports: [NotificationsPublisherService, NotificationsInboxService],
})
export class NotificationsInboxModule {}
