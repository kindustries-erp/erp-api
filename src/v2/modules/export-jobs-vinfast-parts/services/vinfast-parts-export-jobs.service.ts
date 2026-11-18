import { Injectable } from '@nestjs/common';

import {
  AbstractExportJobService,
  type ExportJobStartInput,
  type ExportStartResult,
} from '@/v2/core/export-jobs-core';

/** `processId` của luồng SSE xuất bảng kê phụ tùng VinFast (Web lọc theo giá trị này). */
export const VINFAST_PARTS_EXPORT_PROCESS_ID = 'vinfast-parts-xlsx-export';

/**
 * Job nền xuất báo cáo phụ tùng VinFast (tracking) trên lõi `export-jobs-core`.
 * Producer, tên file và fingerprint do `VinfastPartsExportBackgroundService` truyền vào.
 */
@Injectable()
export class VinfastPartsExportJobsService extends AbstractExportJobService {
  constructor() {
    super({ processId: VINFAST_PARTS_EXPORT_PROCESS_ID });
  }

  startBackgroundExport(input: ExportJobStartInput): ExportStartResult {
    return this.startJob(input);
  }
}
