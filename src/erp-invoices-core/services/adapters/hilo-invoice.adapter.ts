import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

@Injectable()
export class HiloInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'HILO';
  private readonly logger = new Logger(HiloInvoiceAdapter.name);
  private readonly defaultBaseUrl = 'https://gsm-einvoice.hilo.com.vn';

  constructor(private readonly registry: ProviderAdapterRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    const code = providerCode.toUpperCase();
    return code === this.providerCode || code === 'GSM';
  }

  async downloadOriginalPdf(
    params: DownloadPdfParams,
  ): Promise<DownloadPdfResult> {
    const searchKey = params.lookupCode?.trim();
    if (!searchKey) {
      return {
        success: false,
        source: 'failed',
        error: 'Thiếu mã tra cứu SearchKey của hóa đơn HILO / GSM',
      };
    }

    const baseUrl = params.lookupUrl?.trim() || this.defaultBaseUrl;

    try {
      const browserHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      };

      // 1. Lấy token & cookies
      const homeRes = await fetch(baseUrl, {
        headers: browserHeaders,
        signal: AbortSignal.timeout(10000),
      });
      const homeHtml = await homeRes.text();
      const setCookie = homeRes.headers.get('set-cookie');
      const cookieHeader = setCookie ? setCookie.split(';')[0] : '';

      const tokenMatch = homeHtml.match(
        /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/,
      );
      const token = tokenMatch ? tokenMatch[1] : '';

      // 2. Tra cứu theo searchKey
      const postBody = new URLSearchParams({
        'Filter.SearchKey': searchKey,
      });
      if (token) postBody.append('__RequestVerificationToken', token);

      const searchRes = await fetch(`${baseUrl}/`, {
        method: 'POST',
        headers: {
          ...browserHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: baseUrl,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body: postBody.toString(),
        signal: AbortSignal.timeout(10000),
      });

      const searchHtml = await searchRes.text();

      // 3. Trích xuất ID nội bộ của hóa đơn
      const templateMatch = searchHtml.match(/ShowInvTemplate\('([^']+)'/);
      if (!templateMatch) {
        return {
          success: false,
          source: 'failed',
          error: `Không tìm thấy hóa đơn trên cổng HILO với mã tra cứu: ${searchKey}`,
        };
      }
      const hiloInvId = templateMatch[1];

      // 4. Tải file PDF gốc
      const pdfUrl = `${baseUrl}/Inv/GetPdf?ID=${encodeURIComponent(hiloInvId)}`;
      const pdfRes = await fetch(pdfUrl, {
        headers: {
          ...browserHeaders,
          Accept: 'application/pdf,application/octet-stream,*/*',
          Referer: baseUrl,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!pdfRes.ok) {
        return {
          success: false,
          source: 'failed',
          error: `Tải PDF từ cổng HILO thất bại (HTTP ${pdfRes.status})`,
        };
      }

      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      if (!this.isValidPdf(pdfBuffer)) {
        return {
          success: false,
          source: 'failed',
          error:
            'Dữ liệu nhận về từ cổng HILO không phải định dạng PDF hợp lệ.',
        };
      }

      this.logger.log(
        `Successfully downloaded HILO/GSM PDF for ${searchKey} (size: ${pdfBuffer.length} bytes)`,
      );

      return {
        success: true,
        source: 'provider_original',
        pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (err: any) {
      this.logger.error(`Hilo adapter error: ${err.message}`);
      return {
        success: false,
        source: 'failed',
        error: `Lỗi kết nối cổng HILO: ${err.message}`,
      };
    }
  }

  private isValidPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 500) return false;
    return buffer.slice(0, 4).toString() === '%PDF';
  }
}
