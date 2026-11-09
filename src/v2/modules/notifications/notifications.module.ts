import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '@/v2/core/notifications-core';
import { NotificationController } from './controllers/notification.controller';
import { NotificationsV2Service } from './notifications.service';

@Module({
  imports: [NotificationsCoreModule],
  controllers: [NotificationController],
  providers: [NotificationsV2Service],
  exports: [NotificationsV2Service],
})
export class NotificationsV2Module {}
