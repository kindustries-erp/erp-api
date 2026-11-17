import { Injectable } from '@nestjs/common';

import {
  AbstractExportJobService,
  type ExportJobStartInput,
  type ExportStartResult,
} from '@/v2/core/export-jobs-core';

/** `processId` của luồng SSE xuất sổ quỹ và sao kê ngân hàng (Web lọc theo giá trị này). */
export const BANK_STATEMENT_EXPORT_PROCESS_ID = 'bank-statement-xlsx-export';

/**
 * Job nền xuất sổ quỹ / sao kê ngân hàng trên lõi `export-jobs-core`.
 * Không dựng file: producer, tên file và fingerprint do code xuất hiện hữu
 * (`BankStatementExportBackgroundService`) truyền vào, nên nội dung xlsx không đổi.
 */
@Injectable()
export class BankStatementsExportJobsService extends AbstractExportJobService {
  constructor() {
    super({ processId: BANK_STATEMENT_EXPORT_PROCESS_ID });
  }

  startBackgroundExport(input: ExportJobStartInput): ExportStartResult {
    return this.startJob(input);
  }
}
