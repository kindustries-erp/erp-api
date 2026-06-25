import { Global, Module } from '@nestjs/common';
import { GraphLayoutService } from './services/graph-layout.service';

@Global()
@Module({
  providers: [GraphLayoutService],
  exports: [GraphLayoutService],
})
export class CommonModule {}
