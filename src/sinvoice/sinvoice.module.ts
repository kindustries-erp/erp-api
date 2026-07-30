import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SinvoiceController } from './sinvoice.controller';
import { SinvoiceService } from './sinvoice.service';
import { SinvoiceConfig } from './entities/sinvoice-config.entity';
import { SinvoiceDraft } from './entities/sinvoice-draft.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CorePermission } from '../rbac-core/entities/core-permission.entity';
import { CoreUserRole } from '../rbac-core/entities/core-user-role.entity';
import { SinvoiceCronService } from './sinvoice-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SinvoiceConfig,
      SinvoiceDraft,
      CorePermission,
      CoreUserRole,
    ]),
    NotificationsModule,
  ],
  controllers: [SinvoiceController],
  providers: [SinvoiceService, SinvoiceCronService],
  exports: [SinvoiceService],
})
export class SinvoiceModule {}
