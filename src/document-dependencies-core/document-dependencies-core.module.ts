import { Module, Global } from '@nestjs/common';
import { DocumentDependenciesCoreService } from './document-dependencies-core.service';

@Global()
@Module({
  providers: [DocumentDependenciesCoreService],
  exports: [DocumentDependenciesCoreService],
})
export class DocumentDependenciesCoreModule {}
