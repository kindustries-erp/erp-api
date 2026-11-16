import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpAttachmentsCoreService } from './erp-attachments-core.service';
import { ErpAttachmentsCoreController } from './erp-attachments-core.controller';
import { ErpAttachment } from './entities/erp_attachment.entity';
import { R2Module } from '../r2/r2.module';
import { FileAttachmentsModule } from '@/v2/modules/file-attachments-management/file-attachments-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpAttachment]),
    R2Module,
    FileAttachmentsModule,
  ],
  controllers: [ErpAttachmentsCoreController],
  providers: [ErpAttachmentsCoreService],
  exports: [ErpAttachmentsCoreService],
})
export class ErpAttachmentsCoreModule {}
