import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogsV2Service } from './audit-logs-v2.service';
import { AuditLogController } from './controllers/audit-log.controller';
import { AuditLog } from './entities/audit-log.entity';
import { AuditRetentionJob } from './jobs/audit-retention.job';
import { AuditLogQueryService } from './services/audit-log-query.service';
import { AuditWriterService } from './services/audit-writer.service';

/**
 * Module nhật ký kiểm toán v2: ghi (writer có đệm, interceptor toàn cục), đọc
 * (`/api/v2/audit-logs`) và job retention. Bảng `audit_logs`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogController],
  providers: [
    AuditWriterService,
    AuditLogQueryService,
    AuditLogsV2Service,
    AuditRetentionJob,
  ],
  exports: [AuditWriterService, AuditLogQueryService],
})
export class AuditLogsV2Module {}
