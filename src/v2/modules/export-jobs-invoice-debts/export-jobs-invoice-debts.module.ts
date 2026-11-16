import { Module } from '@nestjs/common';

import { InvoiceDebtsExportJobsService } from './services/invoice-debts-export-jobs.service';

/** Job nền xuất Excel công nợ hóa đơn (lõi `export-jobs-core`). Import vào module chủ erp-invoices-core. */
@Module({
  providers: [InvoiceDebtsExportJobsService],
  exports: [InvoiceDebtsExportJobsService],
})
export class ExportJobsInvoiceDebtsModule {}
