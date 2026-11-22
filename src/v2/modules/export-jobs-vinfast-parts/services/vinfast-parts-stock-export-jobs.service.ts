import { Injectable } from '@nestjs/common';

import {
  AbstractExportJobService,
  type ExportJobStartInput,
  type ExportStartResult,
} from '@/v2/core/export-jobs-core';

/** `processId` của luồng SSE xuất tồn kho phụ tùng VinFast (Web lọc theo giá trị này). */
export const VINFAST_PARTS_STOCK_EXPORT_PROCESS_ID =
  'vinfast-parts-stock-xlsx-export';

/**
 * Job nền xuất tồn kho phụ tùng VinFast trên lõi `export-jobs-core`.
 * Hậu tố sku trong tên file do service cũ dựng trước khi gọi `startBackgroundExport`.
 */
@Injectable()
export class VinfastPartsStockExportJobsService extends AbstractExportJobService {
  constructor() {
    super({ processId: VINFAST_PARTS_STOCK_EXPORT_PROCESS_ID });
  }

  startBackgroundExport(input: ExportJobStartInput): ExportStartResult {
    return this.startJob(input);
  }
}
