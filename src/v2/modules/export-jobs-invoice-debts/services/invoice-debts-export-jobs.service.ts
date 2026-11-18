import { Injectable } from '@nestjs/common';

import {
  AbstractExportJobService,
  type ExportJobStartInput,
  type ExportStartResult,
} from '@/v2/core/export-jobs-core';

export const INVOICE_DEBTS_EXPORT_PROCESS_ID = 'invoice-debts-xlsx-export';

/**
 * Job nền xuất Excel công nợ hóa đơn trên lõi `export-jobs-core`.
 * Không có luồng SSE (Web theo dõi bằng lịch sử). Producer, tên file và
 * fingerprint do `InvoiceDebtsExportBackgroundService` truyền vào, nên nội
 * dung xlsx không đổi.
 */
@Injectable()
export class InvoiceDebtsExportJobsService extends AbstractExportJobService {
  constructor() {
    super({ processId: INVOICE_DEBTS_EXPORT_PROCESS_ID });
  }

  startBackgroundExport(input: ExportJobStartInput): ExportStartResult {
    return this.startJob(input);
  }
}
