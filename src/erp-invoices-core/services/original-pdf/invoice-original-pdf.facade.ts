import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';
import { InvoicePdfDownloadWorkerService } from './invoice-pdf-download-worker.service';
import {
  InvoiceProviderDetectorService,
  InvoiceProviderLookupInfo,
} from './invoice-provider-detector.service';
import { readXmlFromBuffer } from './invoice-xml-reader.helper';
import { R2Service } from '../../../r2/r2.service';

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

const MAX_MANUAL_PDF_BYTES = 10 * 1024 * 1024;

export interface ManualPdfUploadResult {
  invoiceId: string;
  pdfFileKey: string;
  pdfSource: string;
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
  hasXml: boolean;
  hints: { label: string; value: string }[];
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
    private readonly r2Service: R2Service,
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
    const xmlInfo = await this.readXmlLookupInfo(invoice);
    const provider =
      xmlInfo && xmlInfo.providerCode !== 'OTHER' ? xmlInfo : detected;

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      providerCode: provider.providerCode,
      providerName: provider.providerName,
      msttcgp: invoice.msttcgp || provider.msttcgp || null,
      lookupCode: invoice.lookupCode || xmlInfo?.lookupCode || null,
      lookupUrl: invoice.lookupUrl || provider.lookupUrl || null,
      pdfSource: invoice.pdfSource || null,
      pdfFileKey: invoice.pdfFileKey || null,
      pdfError: invoice.pdfError || null,
      hasXml: !!invoice.xmlFileKey,
      hints: xmlInfo?.hints ?? [],
    };
  }

  /** Đọc XML từ R2 để lấy mã tra cứu còn thiếu. Chỉ đọc, không ghi DB. */
  private async readXmlLookupInfo(
    invoice: ErpInvoice,
  ): Promise<InvoiceProviderLookupInfo | null> {
    if (!invoice.xmlFileKey) return null;
    try {
      const fileBuffer = await this.r2Service.downloadBuffer(
        invoice.xmlFileKey,
      );
      const xml = readXmlFromBuffer(fileBuffer, invoice.xmlFileKey);
      return xml
        ? this.detectorService.detectFromXml(xml, invoice.sellerTaxCode)
        : null;
    } catch (err: any) {
      this.logger.warn(
        `Could not read XML for invoice ${invoice.id}: ${err.message}`,
      );
      return null;
    }
  }

  /** Nhận PDF do người dùng tự tải từ cổng NCC. Key do server sinh, không nhận đường dẫn từ client. */
  async uploadManualPdf(
    invoiceId: string,
    fileBuffer: Buffer,
  ): Promise<ManualPdfUploadResult> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
    });
    if (!invoice)
      throw new NotFoundException(`Invoice with ID ${invoiceId} not found`);

    if (fileBuffer.length > MAX_MANUAL_PDF_BYTES) {
      throw new BadRequestException('File PDF vượt quá 10MB');
    }
    if (fileBuffer.subarray(0, 4).toString() !== '%PDF') {
      throw new BadRequestException('Tệp tải lên không phải PDF hợp lệ');
    }

    const pdfFileKey = `invoices/pdf/${invoice.id}.pdf`;
    await this.r2Service.uploadBuffer(
      pdfFileKey,
      fileBuffer,
      'application/pdf',
    );

    invoice.pdfFileKey = pdfFileKey;
    invoice.pdfSource = 'manual_upload';
    invoice.pdfError = null;
    await this.invoiceRepo.save(invoice);

    return {
      invoiceId: invoice.id,
      pdfFileKey,
      pdfSource: 'manual_upload',
    };
  }

  async getSyncStatus(syncId: string): Promise<ErpEInvoiceSync> {
    const sync = await this.syncRepo.findOne({ where: { id: syncId } });
    if (!sync)
      throw new NotFoundException(`Sync session with ID ${syncId} not found`);
    return sync;
  }
}
