import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';

@Injectable()
export class VinfastInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'VINFAST';
  private readonly logger = new Logger(VinfastInvoiceAdapter.name);
  private readonly baseUrl = 'https://e-invoice-tt78.vingroup.net';

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
    const lookupCode = params.lookupCode?.trim();
    if (!lookupCode) {
      return {
        success: false,
        source: 'failed',
        error: 'Thiếu mã tra cứu / salt của hóa đơn VinFast',
      };
    }

    try {
      // 1. Khởi tạo session & lấy token
      const sessionRes = await fetch(`${this.baseUrl}/TraCuu/SearchBySalt`, {
        headers: this.getBrowserHeaders(),
      });
      const sessionHtml = await sessionRes.text();
      const cookies = this.extractCookies(sessionRes);

      if (
        sessionHtml.includes('Request Rejected') ||
        sessionHtml.includes('__CF$cv$params')
      ) {
        return {
          success: false,
          source: 'failed',
          error:
            'Cổng Vingroup kích hoạt lá chắn bảo mật Cloudflare/WAF. Vui lòng mở cổng tra cứu bằng nút 1-chạm trên giao diện.',
        };
      }

      const token = this.extractVerificationToken(sessionHtml);

      // 2. Tải Captcha
      const captchaUrl = `${this.baseUrl}/CaptchaVin/Show?t=${Date.now()}`;
      const captchaRes = await fetch(captchaUrl, {
        headers: this.getBrowserHeaders(cookies),
      });

      if (!captchaRes.ok) {
        return {
          success: false,
          source: 'failed',
          error: `Không thể tải captcha từ Vingroup portal (${captchaRes.status})`,
        };
      }

      const captchaBuffer = Buffer.from(await captchaRes.arrayBuffer());
      const captchaCode = await this.captchaSolver.solveCaptchaImage(
        captchaBuffer,
        'image/jpeg',
      );

      if (!captchaCode) {
        return {
          success: false,
          source: 'failed',
          error: 'Không giải được mã captcha từ cổng Vingroup',
        };
      }

      // 3. Submit form tra cứu
      const postBody = new URLSearchParams({
        salt: lookupCode,
        captcha: captchaCode,
      });
      if (token) postBody.append('__RequestVerificationToken', token);

      const searchRes = await fetch(`${this.baseUrl}/TraCuu/SearchBySalt`, {
        method: 'POST',
        headers: {
          ...this.getBrowserHeaders(cookies),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postBody.toString(),
      });

      const searchHtml = await searchRes.text();

      if (
        searchHtml.includes('Request Rejected') ||
        searchHtml.includes('__CF$cv$params')
      ) {
        return {
          success: false,
          source: 'failed',
          error:
            'Cổng Vingroup yêu cầu xác minh trực tiếp trên trình duyệt. Vui lòng sử dụng liên kết tra cứu 1-chạm.',
        };
      }

      // 4. Tìm link tải PDF
      const pdfDownloadPath = this.extractPdfDownloadLink(searchHtml);
      if (!pdfDownloadPath) {
        return {
          success: false,
          source: 'failed',
          error:
            'Không tìm thấy liên kết tệp PDF trong kết quả tra cứu của Vingroup.',
        };
      }

      const pdfUrl = pdfDownloadPath.startsWith('http')
        ? pdfDownloadPath
        : `${this.baseUrl}${pdfDownloadPath}`;

      const pdfRes = await fetch(pdfUrl, {
        headers: this.getBrowserHeaders(cookies),
      });

      if (!pdfRes.ok) {
        return {
          success: false,
          source: 'failed',
          error: `Tải tệp PDF từ cổng Vingroup thất bại (HTTP ${pdfRes.status})`,
        };
      }

      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      if (pdfBuffer.slice(0, 4).toString() !== '%PDF') {
        return {
          success: false,
          source: 'failed',
          error: 'Dữ liệu nhận về từ Vingroup không phải định dạng PDF hợp lệ.',
        };
      }

      return {
        success: true,
        source: 'provider_original',
        pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (err: any) {
      this.logger.error(`Vinfast adapter error: ${err.message}`);
      return {
        success: false,
        source: 'failed',
        error: `Lỗi kết nối cổng Vingroup: ${err.message}`,
      };
    }
  }

  private getBrowserHeaders(cookieStr?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      Referer: `${this.baseUrl}/TraCuu/SearchBySalt`,
    };
    if (cookieStr) headers['Cookie'] = cookieStr;
    return headers;
  }

  private extractCookies(res: Response): string {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    return setCookie
      .split(',')
      .map((c) => c.split(';')[0].trim())
      .join('; ');
  }

  private extractVerificationToken(html: string): string | null {
    const match = html.match(
      /name="__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"/,
    );
    return match ? match[1] : null;
  }

  private extractPdfDownloadLink(html: string): string | null {
    const directMatch = html.match(/href="([^"]+\.pdf[^"]*)"/i);
    if (directMatch) return directMatch[1];
    const actionMatch = html.match(
      /href="(\/TraCuu\/(?:DownloadPdf|ExportPdf|PrintPdf)[^"]*)"/i,
    );
    return actionMatch ? actionMatch[1] : null;
  }
}
