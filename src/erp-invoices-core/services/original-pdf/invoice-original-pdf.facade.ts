import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';
import { InvoicePdfDownloadWorkerService } from './invoice-pdf-download-worker.service';
import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';

export interface SyncAdvancedParams {
  companyTaxCode: string;
  syncType: 'purchase' | 'sold';
  queryType?: 'query' | 'sco-query' | 'all';
  fromDate: string;
  toDate: string;
}

export interface DownloadInvoiceResult {
  invoiceId: string;
  invoiceNo: string;
  success: boolean;
  pdfSource: string | null;
  pdfFileKey: string | null;
  pdfError: string | null;
}

export interface InvoiceLookupInfoResult {
  invoiceId: string;
  invoiceNo: string;
  providerCode: string;
  providerName: string;
  msttcgp: string | null;
  lookupCode: string | null;
  lookupUrl: string | null;
  pdfSource: string | null;
  pdfFileKey: string | null;
  pdfError: string | null;
}

@Injectable()
export class InvoiceOriginalPdfFacade {
  private readonly logger = new Logger(InvoiceOriginalPdfFacade.name);

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpEInvoiceSync)
    private readonly syncRepo: Repository<ErpEInvoiceSync>,
    private readonly workerService: InvoicePdfDownloadWorkerService,
    private readonly detectorService: InvoiceProviderDetectorService,
  ) {}

  async downloadForInvoice(invoiceId: string): Promise<DownloadInvoiceResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });
    if (!invoice)
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);

    const outcome = await this.workerService.downloadSingleInvoice(invoice);
    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      success: outcome.success,
      pdfSource: invoice.pdfSource,
      pdfFileKey: invoice.pdfFileKey,
      pdfError: invoice.pdfError,
    };
  }

  async startAdvancedSync(
    params: SyncAdvancedParams,
    userId?: string,
  ): Promise<{ syncId: string; totalFound: number; status: string }> {
    const sync = this.syncRepo.create({
      companyTaxCode: params.companyTaxCode,
      syncType: params.syncType,
      queryType: params.queryType || 'all',
      fromDate: new Date(params.fromDate),
      toDate: new Date(params.toDate),
      createdBy: userId || null,
      status: 'in_progress',
      totalFound: 0,
      totalPdfSuccess: 0,
      totalPdfFailed: 0,
    });
    const savedSync = await this.syncRepo.save(sync);

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.invoiceDate >= :from', { from: params.fromDate })
      .andWhere('inv.invoiceDate <= :to', { to: params.toDate })
      .andWhere('inv.pdfFileKey IS NULL')
      .andWhere('inv.isDeleted = false');

    if (params.syncType === 'purchase') {
      qb.andWhere('inv.direction = :dir', { dir: 'IN' });
    } else if (params.syncType === 'sold') {
      qb.andWhere('inv.direction = :dir', { dir: 'OUT' });
    }

    const candidates = await qb.select('inv.id').getMany();
    const invoiceIds = candidates.map((c) => c.id);

    savedSync.totalFound = invoiceIds.length;
    await this.syncRepo.save(savedSync);

    if (invoiceIds.length > 0) {
      setImmediate(() => {
        this.workerService
          .processBatch(savedSync.id, invoiceIds)
          .catch((err: any) => {
            this.logger.error(
              `Batch sync error ${savedSync.id}: ${err.message}`,
            );
            this.syncRepo.update(savedSync.id, {
              status: 'failed',
              errorMessage: err.message,
            });
          });
      });
    } else {
      await this.syncRepo.update(savedSync.id, { status: 'completed' });
    }

    return {
      syncId: savedSync.id,
      totalFound: invoiceIds.length,
      status: invoiceIds.length > 0 ? 'in_progress' : 'completed',
    };
  }

  async getLookupInfo(invoiceId: string): Promise<InvoiceLookupInfoResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });
    if (!invoice)
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);

    const detected = this.detectorService.detectFromMetadata(
      invoice.msttcgp,
      invoice.sellerTaxCode,
      invoice.lookupCode,
      invoice.lookupUrl,
    );

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      providerCode: detected.providerCode,
      providerName: detected.providerName,
      msttcgp: invoice.msttcgp || detected.msttcgp || null,
      lookupCode: invoice.lookupCode || null,
      lookupUrl: invoice.lookupUrl || detected.lookupUrl || null,
      pdfSource: invoice.pdfSource || null,
      pdfFileKey: invoice.pdfFileKey || null,
      pdfError: invoice.pdfError || null,
    };
  }

  async getSyncStatus(syncId: string): Promise<ErpEInvoiceSync> {
    const sync = await this.syncRepo.findOne({ where: { id: syncId } });
    if (!sync)
      throw new NotFoundException(`Sync session with ID ${syncId} not found`);
    return sync;
  }
}
