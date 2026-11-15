import { Module } from '@nestjs/common';
import { AuditLogsV2Module } from '@/v2/modules/audit-logs/audit-logs-v2.module';
import { AuditCoreController } from './audit-core.controller';
import { AuditCoreService } from './audit-core.service';

/**
 * Module V1 (tương thích): giữ `AuditCoreService` và route `/api/v1/audit-logs-core`,
 * ủy quyền sang `AuditLogsV2Module`.
 */
@Module({
  imports: [AuditLogsV2Module],
  controllers: [AuditCoreController],
  providers: [AuditCoreService],
  exports: [AuditCoreService],
})
export class AuditCoreModule {}
