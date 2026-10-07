import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ErpInvoice } from '../../entities/erp_invoice.entity';
import { ErpEInvoiceSync } from '../../entities/erp_einvoice_sync.entity';
import { ProviderAdapterRegistry } from '../adapters/provider-adapter.registry';
import { InvoiceProviderDetectorService } from './invoice-provider-detector.service';
import { R2Service } from '../../../r2/r2.service';

@Injectable()
export class InvoicePdfDownloadWorkerService {
  private readonly logger = new Logger(InvoicePdfDownloadWorkerService.name);
  private readonly maxConcurrency = 3;

  constructor(
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpEInvoiceSync)
    private readonly syncRepo: Repository<ErpEInvoiceSync>,
    private readonly adapterRegistry: ProviderAdapterRegistry,
    private readonly detectorService: InvoiceProviderDetectorService,
    private readonly r2Service: R2Service,
    private readonly configService: ConfigService,
  ) {}

  async downloadSingleInvoice(
    invoice: ErpInvoice,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Nếu thiếu provider_code hoặc lookup_code, tự động quét từ XML nếu có
      if (
        (!invoice.providerCode || !invoice.lookupCode) &&
        invoice.xmlFileKey
      ) {
        try {
          const xmlBuffer = await this.r2Service.downloadBuffer(
            invoice.xmlFileKey,
          );
          const xmlContent = xmlBuffer.toString('utf-8');
          const detected = this.detectorService.detectFromXml(
            xmlContent,
            invoice.sellerTaxCode,
          );
          invoice.providerCode = detected.providerCode;
          invoice.lookupCode = detected.lookupCode;
          invoice.lookupUrl = detected.lookupUrl;
          if (detected.msttcgp) invoice.msttcgp = detected.msttcgp;
        } catch (xmlErr: any) {
          this.logger.warn(
            `Could not extract from XML for invoice ${invoice.id}: ${xmlErr.message}`,
          );
        }
      }

      // 2. Tìm adapter phù hợp
      const providerCode = invoice.providerCode || 'OTHER';
      const adapter = this.adapterRegistry.getAdapter(providerCode);

      if (!adapter) {
        invoice.pdfSource = 'failed';
        invoice.pdfError = `Chưa có adapter tự động cho nhà cung cấp ${providerCode}. Vui lòng mở cổng tra cứu bằng nút 1-chạm.`;
        await this.invoiceRepo.save(invoice);
        return { success: false, error: invoice.pdfError };
      }

      // 3. Thực hiện tải PDF gốc
      const result = await adapter.downloadOriginalPdf({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        serialNo: invoice.serialNo,
        invoiceDate: invoice.invoiceDate,
        sellerTaxCode: invoice.sellerTaxCode,
        buyerTaxCode: invoice.buyerTaxCode,
        lookupCode: invoice.lookupCode,
        lookupUrl: invoice.lookupUrl,
      });

      if (!result.success || !result.pdfBuffer) {
        invoice.pdfSource = 'failed';
        invoice.pdfError =
          result.error || 'Tải tệp PDF gốc từ nhà cung cấp thất bại';
        await this.invoiceRepo.save(invoice);
        return { success: false, error: invoice.pdfError };
      }

      // 4. Lưu PDF vào R2 / S3
      const s3Key = `invoices/pdf/${invoice.id}.pdf`;
      await this.r2Service.uploadBuffer(
        s3Key,
        result.pdfBuffer,
        'application/pdf',
      );

      // 5. Lưu cục bộ (nếu có thư mục cấu hình)
      let localPath: string | null = null;
      const localBaseDir =
        this.configService.get<string>('INVOICE_PDF_LOCAL_DIR') ||
        process.env.INVOICE_PDF_LOCAL_DIR;
      if (localBaseDir) {
        try {
          await fs.promises.mkdir(localBaseDir, { recursive: true });
          localPath = path.join(localBaseDir, `${invoice.id}.pdf`);
          await fs.promises.writeFile(localPath, result.pdfBuffer);
        } catch (fsErr: any) {
          this.logger.warn(`Failed to write local PDF: ${fsErr.message}`);
        }
      }

      // 6. Cập nhật trạng thái thành công
      invoice.pdfFileKey = s3Key;
      invoice.pdfPath = localPath;
      invoice.pdfSource = 'provider_original';
      invoice.pdfError = null;
      await this.invoiceRepo.save(invoice);

      return { success: true };
    } catch (err: any) {
      this.logger.error(
        `Error downloading PDF for invoice ${invoice.id}: ${err.message}`,
      );
      invoice.pdfSource = 'failed';
      invoice.pdfError = err.message;
      await this.invoiceRepo.save(invoice);
      return { success: false, error: err.message };
    }
  }

  async processBatch(syncId: string, invoiceIds: string[]): Promise<void> {
    const sync = await this.syncRepo.findOne({ where: { id: syncId } });
    if (!sync) return;

    let successCount = 0;
    let failedCount = 0;

    // Giới hạn concurrency 3 tác vụ đồng thời
    const chunks: string[][] = [];
    for (let i = 0; i < invoiceIds.length; i += this.maxConcurrency) {
      chunks.push(invoiceIds.slice(i, i + this.maxConcurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (invId) => {
          const inv = await this.invoiceRepo.findOne({ where: { id: invId } });
          if (!inv) return;

          inv.syncId = syncId;
          const outcome = await this.downloadSingleInvoice(inv);
          if (outcome.success) {
            successCount++;
          } else {
            failedCount++;
          }
        }),
      );

      // Cập nhật tiến độ định kỳ
      await this.syncRepo.update(syncId, {
        totalPdfSuccess: successCount,
        totalPdfFailed: failedCount,
      });

      // Tránh nghẽn mạng đối tác: delay nhẹ 300ms giữa các chunk
      await new Promise((r) => setTimeout(r, 300));
    }

    await this.syncRepo.update(syncId, {
      totalPdfSuccess: successCount,
      totalPdfFailed: failedCount,
      status: 'completed',
    });
    this.logger.log(
      `Completed batch sync ${syncId}: ${successCount} success, ${failedCount} failed`,
    );
  }
}
