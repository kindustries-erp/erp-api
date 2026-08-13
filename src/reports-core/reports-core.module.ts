import { Module } from '@nestjs/common';
import { ReportsCoreController } from './reports-core.controller';
import { ReportsCoreService } from './reports-core.service';
import { VinfastPartsExportBackgroundService } from './services/vinfast-parts-export-background.service';

@Module({
  controllers: [ReportsCoreController],
  providers: [ReportsCoreService, VinfastPartsExportBackgroundService],
  exports: [ReportsCoreService],
})
export class ReportsCoreModule {}
