import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

import { InvoiceLifecycleService } from './services/invoice-lifecycle.service';
import { InvoicePortalService } from './services/invoice-portal.service';
import { InvoiceImportService } from './services/invoice-import.service';
import { InvoiceFilesService } from './services/invoice-files.service';
import { InvoiceQueryService } from './services/invoice-query.service';
import type { PortalProgressEvent } from './services/invoice-portal.service';
import { CreateErpInvoiceDto } from './dto/create-erp-invoice.dto';
import { UpdateErpInvoiceDto } from './dto/update-erp-invoice.dto';
import { PostInvoiceDto } from './dto/post-invoice.dto';
import { PortalFetchDto } from './dto/portal-invoice.dto';

// Re-export result types so existing imports keep working
export type {
  BulkImportSkippedItem,
  BulkImportErrorItem,
  BulkImportResult,
} from './services/invoice-import.service';

export interface ErpInvoiceQuery {
  direction?: string;
  search?: string;
  seller_name?: string;
  buyer_name?: string;
  partner_tax_code?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  tag_id?: string;
  page?: number;
  pageSize?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  export_type?: 'summary' | 'detailed';
  column_search?: string;
  column_filters?: string;
  is_valid?: string;
}

/**
 * ErpInvoicesCoreService — thin facade that delegates to focused subservices.
 *
 * Public API is identical to the previous monolith; the controller and cron
 * service require NO changes.
 */
@Injectable()
export class ErpInvoicesCoreService {
  /**
   * SSE stream forwarded from InvoicePortalService.
   * Controller accesses `this.service.progress$` so we keep it here.
   */
  get progress$(): Subject<PortalProgressEvent> {
    return this.portalService.progress$;
  }

  constructor(
    private readonly lifecycleService: InvoiceLifecycleService,
    private readonly portalService: InvoicePortalService,
    private readonly importService: InvoiceImportService,
    private readonly filesService: InvoiceFilesService,
    private readonly queryService: InvoiceQueryService,
  ) {}

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  findAll(query: ErpInvoiceQuery) {
    return this.queryService.findAll(query);
  }

  getColumnOptions(
    column: string,
    search: string,
    page: number = 1,
    pageSize: number = 20,
    filtersStr?: string,
    direction?: 'IN' | 'OUT',
  ) {
    return this.queryService.getColumnOptions(
      column,
      search,
      page,
      pageSize,
      filtersStr,
      direction,
    );
  }

  exportExcel(query: ErpInvoiceQuery) {
    return this.queryService.exportExcel(query);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  findOne(id: string) {
    return this.lifecycleService.findOne(id);
  }

  create(dto: CreateErpInvoiceDto) {
    return this.lifecycleService.create(dto);
  }

  update(id: string, dto: UpdateErpInvoiceDto) {
    return this.lifecycleService.update(id, dto);
  }

  remove(id: string) {
    return this.lifecycleService.remove(id);
  }

  cancel(id: string) {
    return this.lifecycleService.cancel(id);
  }

  bulkSetBranch(ids: string[], branchId: string | null) {
    return this.lifecycleService.bulkSetBranch(ids, branchId);
  }

  setInvoiceValid(id: string, isValid: boolean, userId: string) {
    return this.lifecycleService.setInvoiceValid(id, isValid, userId);
  }

  postInvoice(id: string, dto: PostInvoiceDto) {
    return this.lifecycleService.postInvoice(id, dto);
  }

  unpostInvoice(id: string) {
    return this.lifecycleService.unpostInvoice(id);
  }

  linkVouchersToInvoice(
    invoiceId: string,
    payload: { bankTransactionId: string; netOffAmount?: number }[],
  ) {
    return this.lifecycleService.linkVouchersToInvoice(invoiceId, payload);
  }

  removeVoucherFromInvoice(invoiceId: string, voucherId: string) {
    return this.lifecycleService.removeVoucherFromInvoice(invoiceId, voucherId);
  }

  // ---------------------------------------------------------------------------
  // Portal
  // ---------------------------------------------------------------------------

  getPortalConfig() {
    return this.portalService.getPortalConfig();
  }

  savePortalConfig(token: string, cookies?: string) {
    return this.portalService.savePortalConfig(token, cookies);
  }

  checkTokenValid(token: string, cookies?: string) {
    return this.portalService.checkTokenValid(token, cookies);
  }

  syncFromPortal(dto: PortalFetchDto, userId?: string) {
    return this.portalService.syncFromPortal(dto, userId);
  }

  reparseXml(id: string, token?: string, cookies?: string) {
    return this.portalService.reparseXml(id, token, cookies);
  }

  bulkDownloadXml(
    token: string | undefined,
    cookies: string | undefined,
    direction: 'IN' | 'OUT',
  ) {
    return this.portalService.bulkDownloadXml(token, cookies, direction);
  }

  syncDetailFromPortal(id: string, token?: string, cookies?: string) {
    return this.portalService.syncDetailFromPortal(id, token, cookies);
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  bulkImportBuyerXml(files: Array<{ filename: string; buffer: Buffer }>) {
    return this.importService.bulkImportBuyerXml(files);
  }

  bulkImportSellerXml(files: Array<{ filename: string; buffer: Buffer }>) {
    return this.importService.bulkImportSellerXml(files);
  }

  bulkImportMixed(
    files: Array<{ filename: string; buffer: Buffer; mimetype: string }>,
    direction: 'IN' | 'OUT',
  ) {
    return this.importService.bulkImportMixed(files, direction);
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------

  getFileDownloadUrl(invoiceId: string, fileType: 'pdf' | 'xml') {
    return this.filesService.getFileDownloadUrl(invoiceId, fileType);
  }

  getFileUploadUrl(invoiceId: string, fileType: 'pdf' | 'xml') {
    return this.filesService.getFileUploadUrl(invoiceId, fileType);
  }

  uploadPdfs(
    invoiceId: string,
    files: { filename: string; buffer: Buffer; mimetype: string }[],
  ) {
    return this.filesService.uploadPdfs(invoiceId, files);
  }

  getPdfContent(invoiceId: string, fileKey: string) {
    return this.filesService.getPdfContent(invoiceId, fileKey);
  }

  getPdfDownloadUrl(invoiceId: string, fileKey: string, inline = false) {
    return this.filesService.getPdfDownloadUrl(invoiceId, fileKey, inline);
  }

  downloadAllPdfsZip(invoiceId: string) {
    return this.filesService.downloadAllPdfsZip(invoiceId);
  }

  bulkDownloadFilesZip(
    payload: { query: ErpInvoiceQuery; types: string[] },
    res: any,
  ) {
    return this.filesService.bulkDownloadFilesZip(payload, res);
  }

  deletePdf(invoiceId: string, fileKey: string) {
    return this.filesService.deletePdf(invoiceId, fileKey);
  }
}
