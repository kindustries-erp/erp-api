import { Injectable, OnModuleDestroy } from '@nestjs/common';

import {
  ExportJobRunner,
  formatExportTimestamp,
  normalizeJsonString,
  stableStringify,
  type ExportHistoryItem,
  type ExportHistoryResult,
  type ExportProgressEvent,
} from '../../common/export-jobs/export-job-runner';
import type { ErpInvoiceQuery } from '../erp-invoices-core.service';
import { InvoiceQueryService } from './invoice-query.service';

export type InvoiceExportProgressEvent = ExportProgressEvent;
export type InvoiceExportHistoryItem = ExportHistoryItem;
export type InvoiceExportHistoryResult = ExportHistoryResult;

@Injectable()
export class InvoiceExportBackgroundService implements OnModuleDestroy {
  private readonly runner = new ExportJobRunner({
    processId: 'invoice-xlsx-export',
  });

  public readonly progress$ = this.runner.progress$;

  constructor(private readonly invoiceQueryService: InvoiceQueryService) {}

  onModuleDestroy() {
    this.runner.destroy();
  }

  async startBackgroundExport(query: ErpInvoiceQuery, userId: string) {
    const dirText = query.direction === 'OUT' ? 'dau_ra' : 'dau_vao';

    return this.runner.start({
      userId,
      fingerprint: this.buildQueryFingerprint(query),
      fileName: `Bao_cao_hoa_don_${dirText}_${formatExportTimestamp(new Date())}.xlsx`,
      totalUnits: InvoiceQueryService.EXPORT_PROGRESS_TOTAL_UNITS,
      dateFrom: query.date_from,
      dateTo: query.date_to,
      producer: (onProgress) =>
        this.invoiceQueryService.exportExcel(query, { onProgress }),
    });
  }

  listHistoryForUser(
    userId: string,
    page = 1,
    pageSize = 10,
  ): InvoiceExportHistoryResult {
    return this.runner.listHistoryForUser(userId, page, pageSize);
  }

  getJobSnapshotForUser(userId: string): InvoiceExportProgressEvent | null {
    return this.runner.getJobSnapshotForUser(userId);
  }

  getReadyExportFile(jobId: string, userId: string) {
    return this.runner.getReadyFile(jobId, userId);
  }

  private buildQueryFingerprint(query: ErpInvoiceQuery) {
    let selectedColumnsNormalized: string[] = [];
    if (Array.isArray(query.selected_columns)) {
      selectedColumnsNormalized = query.selected_columns
        .map((c) => String(c).trim())
        .filter(Boolean)
        .sort();
    } else if (
      typeof query.selected_columns === 'string' &&
      query.selected_columns.trim()
    ) {
      try {
        const parsed = JSON.parse(query.selected_columns);
        if (Array.isArray(parsed)) {
          selectedColumnsNormalized = parsed
            .map((c) => String(c).trim())
            .filter(Boolean)
            .sort();
        } else {
          selectedColumnsNormalized = query.selected_columns
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
            .sort();
        }
      } catch {
        selectedColumnsNormalized = query.selected_columns
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .sort();
      }
    }

    const normalized = {
      direction: query.direction || '',
      search: (query.search || '').trim(),
      seller_name: (query.seller_name || '').trim(),
      buyer_name: (query.buyer_name || '').trim(),
      partner_tax_code: (query.partner_tax_code || '').trim(),
      date_from: query.date_from || '',
      date_to: query.date_to || '',
      status: (query.status || '').trim(),
      tag_id: (query.tag_id || '').trim(),
      is_valid: (query.is_valid || '').trim(),
      column_search: normalizeJsonString(query.column_search),
      column_filters: normalizeJsonString(query.column_filters),
      selected_columns: selectedColumnsNormalized,
    };

    return stableStringify(normalized);
  }
}
