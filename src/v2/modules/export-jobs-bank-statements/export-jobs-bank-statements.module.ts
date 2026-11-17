import { Module } from '@nestjs/common';

import { BankStatementsExportJobsService } from './services/bank-statements-export-jobs.service';

/** Job nền xuất sổ quỹ / sao kê (lõi `export-jobs-core`). Import vào module chủ bank-transactions-core. */
@Module({
  providers: [BankStatementsExportJobsService],
  exports: [BankStatementsExportJobsService],
})
export class ExportJobsBankStatementsModule {}
