import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

@Injectable()
export class MisaInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'MISA';
  private readonly logger = new Logger(MisaInvoiceAdapter.name);
  private readonly baseUrl = 'https://www.meinvoice.vn';

  constructor(private readonly registry: ProviderAdapterRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    return providerCode.toUpperCase() === this.providerCode;
  }

  async downloadOriginalPdf(
    params: DownloadPdfParams,
  ): Promise<DownloadPdfResult> {
    const transactionId = params.lookupCode?.trim();
    if (!transactionId) {
      return {
        success: false,
        source: 'failed',
        error: 'Thiếu mã tra cứu / TransactionID của hóa đơn MISA meInvoice',
      };
    }

    const candidateUrls = [
      `https://viewer.meinvoice.vn/api/viewer/download?transactionId=${encodeURIComponent(transactionId)}`,
      `${this.baseUrl}/tra-cuu/api/invoices/download-pdf?transactionId=${encodeURIComponent(transactionId)}`,
      `${this.baseUrl}/tra-cuu/api/downloadpdf?transactionId=${encodeURIComponent(transactionId)}`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: this.getBrowserHeaders(),
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (this.isValidPdf(buffer)) {
            this.logger.log(
              `Successfully downloaded MISA PDF for ${transactionId} (size: ${buffer.length} bytes)`,
            );
            return {
              success: true,
              source: 'provider_original',
              pdfBuffer: buffer,
              contentType: 'application/pdf',
            };
          }
        }
      } catch (err: any) {
        this.logger.debug(`Failed MISA endpoint ${url}: ${err.message}`);
      }
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Cổng MISA meInvoice yêu cầu xác thực phiên tra cứu. Vui lòng sử dụng liên kết tra cứu 1-chạm để tải trực tiếp.',
    };
  }

  private isValidPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 10) return false;
    return buffer.slice(0, 4).toString() === '%PDF';
  }

  private getBrowserHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept:
        'application/pdf,application/octet-stream,text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      Referer: 'https://www.meinvoice.vn/tra-cuu/',
    };
  }
}
