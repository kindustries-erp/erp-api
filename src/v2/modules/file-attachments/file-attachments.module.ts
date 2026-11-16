import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { R2Module } from '@/r2/r2.module';
import {
  FILE_KEY_REFERENCE_SOURCES,
  FileOwnerRegistry,
  STORAGE_POLICY_PROVIDER,
} from '@/v2/core/storage-core';
import { AuditLogsV2Module } from '@/v2/modules/audit-logs/audit-logs-v2.module';
import { FileAttachmentsController } from './controllers/file-attachments.controller';
import { FileAttachmentSettings } from './entities/file-attachment-settings.entity';
import { FileAttachment } from './entities/file-attachment.entity';
import { FileAttachmentsService } from './file-attachments.service';
import { FileAttachmentPurgeJob } from './jobs/file-attachment-purge.job';
import { CodeStoragePolicyProvider } from './services/code-storage-policy.provider';
import { FileAttachmentCommandService } from './services/file-attachment-command.service';
import { FileAttachmentPurgeService } from './services/file-attachment-purge.service';
import { FileAttachmentQueryService } from './services/file-attachment-query.service';
import { FileAttachmentSettingsService } from './services/file-attachment-settings.service';
import { FileKeyReferenceChecker } from './services/file-key-reference.checker';
import {
  FileAttachmentsKeySource,
  InvoiceKeysSource,
  LegacyAttachmentsKeySource,
} from './services/file-key-reference.sources';
import { FileStorageGateway } from './services/file-storage.gateway';
import { LegacyFileRegistrarService } from './services/legacy-file-registrar.service';

/**
 * Module file đính kèm V2 (R2) dùng chung nhiều owner. Owner module (vd. `invoices-finance`)
 * đăng ký `FileOwnerPolicyPort` vào `FileOwnerRegistry` và khai báo controller mỏng của mình.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FileAttachment, FileAttachmentSettings]),
    R2Module,
    AuditLogsV2Module,
  ],
  controllers: [FileAttachmentsController],
  providers: [
    FileOwnerRegistry,
    { provide: STORAGE_POLICY_PROVIDER, useClass: CodeStoragePolicyProvider },
    FileStorageGateway,
    FileAttachmentsKeySource,
    LegacyAttachmentsKeySource,
    InvoiceKeysSource,
    {
      provide: FILE_KEY_REFERENCE_SOURCES,
      useFactory: (...sources: unknown[]) => sources,
      inject: [
        FileAttachmentsKeySource,
        LegacyAttachmentsKeySource,
        InvoiceKeysSource,
      ],
    },
    FileKeyReferenceChecker,
    FileAttachmentCommandService,
    FileAttachmentQueryService,
    FileAttachmentSettingsService,
    FileAttachmentPurgeService,
    FileAttachmentPurgeJob,
    FileAttachmentsService,
    LegacyFileRegistrarService,
  ],
  exports: [
    FileAttachmentsService,
    LegacyFileRegistrarService,
    FileAttachmentCommandService,
    FileOwnerRegistry,
    STORAGE_POLICY_PROVIDER,
  ],
})
export class FileAttachmentsModule {}
