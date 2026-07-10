import { Module } from '@nestjs/common';
import { ReportsCoreController } from './reports-core.controller';
import { ReportsCoreService } from './reports-core.service';

@Module({
  controllers: [ReportsCoreController],
  providers: [ReportsCoreService],
  exports: [ReportsCoreService],
})
export class ReportsCoreModule {}
