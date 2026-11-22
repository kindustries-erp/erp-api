import { Module } from '@nestjs/common';

import { VinfastPartsExportJobsService } from './services/vinfast-parts-export-jobs.service';
import { VinfastPartsStockExportJobsService } from './services/vinfast-parts-stock-export-jobs.service';

/** Job nền xuất Excel phụ tùng VinFast (tracking và tồn kho), lõi `export-jobs-core`. */
@Module({
  providers: [
    VinfastPartsExportJobsService,
    VinfastPartsStockExportJobsService,
  ],
  exports: [VinfastPartsExportJobsService, VinfastPartsStockExportJobsService],
})
export class ExportJobsVinfastPartsModule {}
