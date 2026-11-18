import { Module } from '@nestjs/common';
import { ReportsCoreController } from './reports-core.controller';
import { ReportsCoreService } from './reports-core.service';
import { VinfastPartsExportBackgroundService } from './services/vinfast-parts-export-background.service';
import { ExportJobsVinfastPartsModule } from '@/v2/modules/export-jobs-vinfast-parts';

@Module({
  imports: [ExportJobsVinfastPartsModule],
  controllers: [ReportsCoreController],
  providers: [ReportsCoreService, VinfastPartsExportBackgroundService],
  exports: [ReportsCoreService],
})
export class ReportsCoreModule {}
