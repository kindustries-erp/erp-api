import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SinvoiceController } from './sinvoice.controller';
import { SinvoiceService } from './sinvoice.service';
import { SinvoiceConfig } from './entities/sinvoice-config.entity';
import { SinvoiceDraft } from './entities/sinvoice-draft.entity';
import { NotificationsInboxModule } from '@/v2/modules/notifications-inbox';
import { RbacPermission } from '@/v2/modules/rbac-roles/entities/rbac-permission.entity';
import { RbacUserRole } from '@/v2/modules/rbac-roles/entities/rbac-user-role.entity';
import { SinvoiceCronService } from './sinvoice-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SinvoiceConfig,
      SinvoiceDraft,
      RbacPermission,
      RbacUserRole,
    ]),
    NotificationsInboxModule,
  ],
  controllers: [SinvoiceController],
  providers: [SinvoiceService, SinvoiceCronService],
  exports: [SinvoiceService],
})
export class SinvoiceModule {}
