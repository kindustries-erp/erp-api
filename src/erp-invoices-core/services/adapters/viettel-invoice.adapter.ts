import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

@Injectable()
export class ViettelInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'VIETTEL';
  private readonly logger = new Logger(ViettelInvoiceAdapter.name);
  private readonly baseUrl = 'https://sinvoice.viettel.vn';

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
    const reservationCode = params.lookupCode?.trim();
    if (!reservationCode) {
      return {
        success: false,
        source: 'failed',
        error:
          'Thiếu mã số bí mật / ReservationCode của hóa đơn Viettel S-Invoice',
      };
    }

    const sellerTaxCode = params.sellerTaxCode?.trim() || '';
    const candidateUrls = [
      `${this.baseUrl}/sinvoice/portal/invoice/downloadPdf?reservationCode=${encodeURIComponent(reservationCode)}&supplierTaxCode=${encodeURIComponent(sellerTaxCode)}`,
      `${this.baseUrl}/sinvoice/portal/invoice/downloadPdf?reservationCode=${encodeURIComponent(reservationCode)}`,
      `${this.baseUrl}/api/invoice/download-pdf?reservationCode=${encodeURIComponent(reservationCode)}`,
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
              `Successfully downloaded Viettel PDF for ${reservationCode} (size: ${buffer.length} bytes)`,
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
        this.logger.debug(`Failed Viettel endpoint ${url}: ${err.message}`);
      }
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Cổng Viettel S-Invoice yêu cầu xác thực phiên tra cứu. Vui lòng sử dụng liên kết tra cứu 1-chạm để tải trực tiếp.',
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
      Referer: 'https://sinvoice.viettel.vn/tracuuhoadon',
    };
  }
}
