import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationCore } from './entities/notification.entity';
import { NotificationCommandService } from './services/notification-command.service';
import { NotificationQueryService } from './services/notification-query.service';
import { NotificationsCoreService } from './services/notifications-core.service';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationCore])],
  providers: [
    NotificationQueryService,
    NotificationCommandService,
    NotificationsCoreService,
  ],
  exports: [
    NotificationQueryService,
    NotificationCommandService,
    NotificationsCoreService,
  ],
})
export class NotificationsCoreModule {}
