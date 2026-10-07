import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';

@Injectable()
export class EasyInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'EASYINVOICE';
  private readonly logger = new Logger(EasyInvoiceAdapter.name);

  constructor(
    private readonly captchaSolver: InvoiceCaptchaSolverService,
    private readonly registry: ProviderAdapterRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    return providerCode.toUpperCase() === this.providerCode;
  }

  async downloadOriginalPdf(
    params: DownloadPdfParams,
  ): Promise<DownloadPdfResult> {
    const fkey = params.lookupCode?.trim();
    if (!fkey) {
      return {
        success: false,
        source: 'failed',
        error: 'Thiếu mã tra cứu Fkey của hóa đơn EasyInvoice',
      };
    }

    let portalUrl =
      params.lookupUrl?.trim() ||
      params.extraInfo?.portalLink?.trim() ||
      'https://tracuu.easyinvoice.vn';

    if (!portalUrl.startsWith('http')) {
      portalUrl = `https://${portalUrl}`;
    }
    portalUrl = portalUrl.replace(/\/$/, '');

    const candidateUrls = [
      `${portalUrl}/einvoice/print?fkey=${encodeURIComponent(fkey)}&type=pdf`,
      `${portalUrl}/viewer/getpdf?fkey=${encodeURIComponent(fkey)}`,
      `${portalUrl}/api/viewer/getpdf?fkey=${encodeURIComponent(fkey)}`,
      `${portalUrl}/viewer/viewpdf?fkey=${encodeURIComponent(fkey)}`,
    ];

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: this.getBrowserHeaders(portalUrl),
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (this.isValidPdf(buffer)) {
            this.logger.log(
              `Successfully downloaded EasyInvoice PDF from ${url} (size: ${buffer.length} bytes)`,
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
        this.logger.debug(`Failed endpoint ${url}: ${err.message}`);
      }
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Cổng EasyInvoice của bên bán yêu cầu xác thực phiên hoặc mã bảo mật. Vui lòng sử dụng liên kết tra cứu 1-chạm.',
    };
  }

  private isValidPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 10) return false;
    return buffer.slice(0, 4).toString() === '%PDF';
  }

  private getBrowserHeaders(refererUrl: string): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept:
        'application/pdf,application/octet-stream,text/html,application/xhtml+xml,*/*',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      Referer: refererUrl,
    };
  }
}
