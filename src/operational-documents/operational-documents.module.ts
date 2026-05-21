import { Module } from '@nestjs/common';
import { OperationalDocumentsController } from './operational-documents.controller';
import { OperationalDocumentsService } from './operational-documents.service';

@Module({
  controllers: [OperationalDocumentsController],
  providers: [OperationalDocumentsService],
})
export class OperationalDocumentsModule {}
