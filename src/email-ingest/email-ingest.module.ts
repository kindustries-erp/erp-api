import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SysFile } from '../files/entities/sys-file.entity';
import { R2Module } from '../r2/r2.module';
import { EmailIngestController } from './email-ingest.controller';
import { EmailIngestService } from './email-ingest.service';
import { ErpEmailAttachment } from './entities/erp_email_attachment.entity';
import { ErpEmailMessage } from './entities/erp_email_message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErpEmailMessage, ErpEmailAttachment, SysFile]),
    R2Module,
  ],
  controllers: [EmailIngestController],
  providers: [EmailIngestService],
  exports: [EmailIngestService],
})
export class EmailIngestModule {}
