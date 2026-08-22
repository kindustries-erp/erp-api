import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditCoreController } from './audit-core.controller';
import { AuditCoreService } from './audit-core.service';
import { AuditRetentionScheduler } from './schedulers/audit-retention.scheduler';
import { ErpAuditLog } from './entities/erp-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ErpAuditLog])],
  controllers: [AuditCoreController],
  providers: [AuditCoreService, AuditRetentionScheduler],
  exports: [AuditCoreService, AuditRetentionScheduler],
})
export class AuditCoreModule {}
