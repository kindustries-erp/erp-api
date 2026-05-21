import { Module } from '@nestjs/common';
import { OperationalDocumentsController } from './operational-documents.controller';
import { OperationalDocumentsService } from './operational-documents.service';
import { OperationalRecurringService } from './operational-recurring.service';

@Module({
  controllers: [OperationalDocumentsController],
  providers: [OperationalDocumentsService, OperationalRecurringService],
  exports: [OperationalDocumentsService],
})
export class OperationalDocumentsModule {}
