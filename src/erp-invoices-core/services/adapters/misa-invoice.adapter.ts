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
  private readonly defaultBaseUrl = 'https://www.meinvoice.vn';

  constructor(private readonly registry: ProviderAdapterRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    const code = providerCode.toUpperCase();
    return code === this.providerCode || code === 'MEINVOICE';
  }

  async downloadOriginalPdf(
    params: DownloadPdfParams,
  ): Promise<DownloadPdfResult> {
    const transactionId = params.lookupCode?.trim();
    if (!transactionId) {
      return {
        success: false,
        source: 'failed',
        error: 'Thiếu mã tra cứu TransactionID của hóa đơn MISA meInvoice',
      };
    }

    const baseUrl = (params.lookupUrl?.trim() || this.defaultBaseUrl).replace(
      /\/tra-cuu\/?$/i,
      '',
    );

    try {
      const browserHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      };

      // 1. Khởi tạo session ASP.NET và lấy cookies (_msid, TS01c1f2f5)
      const initRes = await fetch(`${baseUrl}/tra-cuu/`, {
        headers: browserHeaders,
        signal: AbortSignal.timeout(10000),
      });

      const rawCookies = initRes.headers.getSetCookie
        ? initRes.headers.getSetCookie()
        : [initRes.headers.get('set-cookie') || ''];
      const cookies = rawCookies
        .map((c) => c.split(';')[0])
        .filter(Boolean)
        .join('; ');

      // 2. Tra cứu hóa đơn theo transactionID (x-www-form-urlencoded)
      const postParams = new URLSearchParams();
      postParams.append('transactionID', transactionId);

      const postRes = await fetch(
        `${baseUrl}/tra-cuu/GetInvoiceDataByTransactionID`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': browserHeaders['User-Agent'],
            Referer: `${baseUrl}/tra-cuu/`,
            Origin: baseUrl,
            Cookie: cookies,
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: postParams.toString(),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!postRes.ok) {
        return {
          success: false,
          source: 'failed',
          error: `Truy vấn dữ liệu hóa đơn MISA thất bại (HTTP ${postRes.status})`,
        };
      }

      const postJson = await postRes.json();
      if (!postJson.success || !postJson.customData) {
        const errMsg =
          postJson.errorCode ||
          postJson.errors ||
          'Mã số tra cứu không đúng hoặc hóa đơn không tồn tại trên MISA meInvoice.';
        return {
          success: false,
          source: 'failed',
          error: `MISA meInvoice từ chối tra cứu: ${errMsg}`,
        };
      }

      const extToken = postJson.customData;

      // 3. Tải PDF gốc thông qua DownloadHandler.ashx
      const dlUrl = `${baseUrl}/tra-cuu/DownloadHandler.ashx?Type=pdf&Viewer=1&ext=${encodeURIComponent(
        extToken,
      )}&Code=${encodeURIComponent(transactionId)}`;
      const dlRes = await fetch(dlUrl, {
        headers: {
          'User-Agent': browserHeaders['User-Agent'],
          Referer: `${baseUrl}/tra-cuu/`,
          Cookie: cookies,
          Accept: 'application/pdf,text/html,*/*',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!dlRes.ok) {
        return {
          success: false,
          source: 'failed',
          error: `Tải PDF từ cổng MISA thất bại (HTTP ${dlRes.status})`,
        };
      }

      const pdfBuffer = Buffer.from(await dlRes.arrayBuffer());
      if (!this.isValidPdf(pdfBuffer)) {
        return {
          success: false,
          source: 'failed',
          error:
            'Dữ liệu nhận về từ cổng MISA không phải định dạng PDF hợp lệ.',
        };
      }

      this.logger.log(
        `Successfully downloaded MISA PDF for ${transactionId} (size: ${pdfBuffer.length} bytes)`,
      );

      return {
        success: true,
        source: 'provider_original',
        pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (err: any) {
      this.logger.error(`Misa adapter error: ${err.message}`);
      return {
        success: false,
        source: 'failed',
        error: `Lỗi kết nối cổng MISA: ${err.message}`,
      };
    }
  }

  private isValidPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 500) return false;
    return buffer.slice(0, 4).toString() === '%PDF';
  }
}
