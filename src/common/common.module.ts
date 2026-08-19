import { Global, Module } from '@nestjs/common';
import { GraphLayoutService } from './services/graph-layout.service';
import { DocumentTraceabilityService } from './services/document-traceability.service';

@Global()
@Module({
  providers: [GraphLayoutService, DocumentTraceabilityService],
  exports: [GraphLayoutService, DocumentTraceabilityService],
})
export class CommonModule {}
