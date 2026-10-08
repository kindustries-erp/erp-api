import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import AdmZip from 'adm-zip';
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
  private readonly defaultPortalUrl = 'https://tracuu.easyinvoice.vn';

  constructor(
    private readonly captchaSolver: InvoiceCaptchaSolverService,
    private readonly registry: ProviderAdapterRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    const code = providerCode?.toUpperCase();
    return code === this.providerCode || code === 'SOFTDREAMS';
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

    const sellerTaxCode = params.sellerTaxCode?.trim() || '';

    // Xác định danh sách portal URLs cần thử (portal bên bán & cổng tổng)
    const portalUrls: string[] = [];
    const candidatePortal =
      params.lookupUrl?.trim() || params.extraInfo?.portalLink?.trim();

    if (candidatePortal) {
      let formatted = candidatePortal;
      if (!formatted.startsWith('http')) {
        formatted = `https://${formatted}`;
      }
      formatted = formatted.replace(/\/$/, '');
      portalUrls.push(formatted);
    }

    if (!portalUrls.includes(this.defaultPortalUrl)) {
      portalUrls.push(this.defaultPortalUrl);
    }

    // 1. Thử direct URL nhanh (nếu portal bên bán cho phép tải trực tiếp)
    for (const portal of portalUrls) {
      const directResult = await this.tryDirectCandidates(portal, fkey);
      if (directResult) {
        return directResult;
      }
    }

    // 2. Tra cứu qua pipeline chính thức của EasyInvoice (AI Captcha + Server-side PDF export)
    for (const portal of portalUrls) {
      const result = await this.tryDownloadFromPortal(
        portal,
        sellerTaxCode,
        fkey,
        params.invoiceNo,
      );
      if (result.success) {
        return result;
      }
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Không thể tải tệp PDF gốc từ cổng EasyInvoice sau các lần thử. Vui lòng mở cổng tra cứu 1-chạm.',
    };
  }

  private async tryDirectCandidates(
    portalUrl: string,
    fkey: string,
  ): Promise<DownloadPdfResult | null> {
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
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          if (this.isValidPdf(buffer)) {
            this.logger.log(
              `[EasyInvoice] Tải thành công PDF trực tiếp từ candidate ${url} (${buffer.length} bytes)`,
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
        this.logger.debug(
          `[EasyInvoice] Direct candidate ${url} failed: ${err.message}`,
        );
      }
    }
    return null;
  }

  private async tryDownloadFromPortal(
    portalUrl: string,
    sellerTaxCode: string,
    fkey: string,
    invoiceNo?: string,
  ): Promise<DownloadPdfResult> {
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `[EasyInvoice] Đang kết nối ${portalUrl} (Lần ${attempt}/${maxRetries}) cho HĐ ${invoiceNo || fkey}`,
        );

        // a. Lấy Captcha và Session Cookie
        const captchaUrl = `${portalUrl}/Captcha/Show?t=${Date.now()}`;
        const capRes = await fetch(captchaUrl, {
          headers: {
            ...this.getBrowserHeaders(portalUrl),
            Referer: portalUrl,
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!capRes.ok) {
          throw new Error(`Không thể tải ảnh Captcha (HTTP ${capRes.status})`);
        }

        const rawCookies = capRes.headers.getSetCookie
          ? capRes.headers.getSetCookie()
          : [capRes.headers.get('set-cookie') || ''];
        const cookieHeader = rawCookies
          .map((c) => c.split(';')[0])
          .filter(Boolean)
          .join('; ');

        const capBuffer = Buffer.from(await capRes.arrayBuffer());
        if (capBuffer.length < 100) {
          throw new Error('Ảnh captcha không hợp lệ');
        }

        // b. Giải Captcha bằng AI Vision (9router)
        let captchaText = '';
        try {
          captchaText = await this.captchaSolver.solveCaptchaImage(
            capBuffer,
            'image/png',
          );
        } catch (solveErr: any) {
          this.logger.warn(
            `[EasyInvoice] Lỗi giải captcha: ${solveErr.message}`,
          );
          if (attempt === maxRetries) {
            return {
              success: false,
              source: 'failed',
              error: `Lỗi kết nối bộ giải Captcha AI: ${solveErr.message}`,
            };
          }
          continue;
        }

        // c. Gửi form tra cứu
        const formData = new URLSearchParams();
        if (sellerTaxCode) {
          formData.append('TaxCode', sellerTaxCode);
        }
        formData.append('FKey', fkey);
        formData.append('Capcha', captchaText);
        formData.append('typeSearch', '');
        formData.append('ListInv', '0');
        formData.append('InvData', "''");
        formData.append('msg', '');

        const searchRes = await fetch(`${portalUrl}/Search/Search`, {
          method: 'POST',
          headers: {
            ...this.getBrowserHeaders(portalUrl),
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: portalUrl,
            Origin: portalUrl,
            Cookie: cookieHeader,
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(12000),
        });

        if (!searchRes.ok) {
          throw new Error(`Gửi tra cứu thất bại (HTTP ${searchRes.status})`);
        }

        const searchHtml = await searchRes.text();

        // Kiểm tra thông báo lỗi captcha
        if (
          searchHtml.includes('Mã xác thực không chính xác') ||
          searchHtml.includes('Sai mã xác thực')
        ) {
          this.logger.warn(
            `[EasyInvoice] Captcha "${captchaText}" bị từ chối ở lần thử ${attempt}. Đang thử lại...`,
          );
          continue;
        }

        // d. Bóc tách invToken từ lệnh showInv
        const tokenMatch = searchHtml.match(
          /showInv\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*'([^']+)'\)/,
        );
        if (!tokenMatch) {
          this.logger.debug(
            `[EasyInvoice] Không tìm thấy invToken trong phản hồi tra cứu của ${portalUrl}`,
          );
          return {
            success: false,
            source: 'failed',
            error:
              'Không tìm thấy thông tin hóa đơn trên EasyInvoice với mã Fkey đã cung cấp.',
          };
        }
        const invToken = tokenMatch[1];

        // e. Bóc tách cấu trúc HTML từ InvData
        const invDataMatch = searchHtml.match(
          /id="InvData"[^>]*value="([^"]+)"/i,
        );
        let bodyContent = '';
        if (invDataMatch) {
          try {
            const decoded = invDataMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&');
            const parsed = JSON.parse(decoded);
            const strVal = parsed.str || '';
            const bodyMatch = strVal.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            bodyContent = bodyMatch ? bodyMatch[1] : strVal;
          } catch (jsonErr: any) {
            this.logger.warn(
              `[EasyInvoice] Không thể parse InvData JSON: ${jsonErr.message}`,
            );
          }
        }

        const base64Body = Buffer.from(bodyContent, 'utf8').toString('base64');

        // f. Gọi API xuất file của EasyInvoice server
        const exportRes = await fetch(
          `${portalUrl}/Invoice/DownloadPdfAndFileAttachFromAvailableHtml`,
          {
            method: 'POST',
            headers: {
              ...this.getBrowserHeaders(portalUrl),
              'Content-Type':
                'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Referer: `${portalUrl}/Search/Search`,
              Origin: portalUrl,
              Cookie: cookieHeader,
            },
            body: new URLSearchParams({
              token: invToken,
              html: base64Body,
            }).toString(),
            signal: AbortSignal.timeout(15000),
          },
        );

        if (!exportRes.ok) {
          throw new Error(
            `Gọi DownloadPdfAndFileAttachFromAvailableHtml thất bại (HTTP ${exportRes.status})`,
          );
        }

        const exportJson: any = await exportRes.json();
        if (!exportJson?.fileGuid) {
          const errMsg =
            exportJson?.msg || 'Máy chủ EasyInvoice không cấp fileGuid';
          throw new Error(errMsg);
        }

        // g. Tải file từ máy chủ EasyInvoice
        const dlUrl = `${portalUrl}/Invoice/Download?fileGuid=${encodeURIComponent(
          exportJson.fileGuid,
        )}&fileName=${encodeURIComponent(exportJson.fileName || 'invoice.zip')}`;

        const dlRes = await fetch(dlUrl, {
          headers: {
            ...this.getBrowserHeaders(portalUrl),
            Referer: `${portalUrl}/Search/Search`,
            Cookie: cookieHeader,
          },
          signal: AbortSignal.timeout(20000),
        });

        if (!dlRes.ok) {
          throw new Error(
            `Tải tệp từ EasyInvoice thất bại (HTTP ${dlRes.status})`,
          );
        }

        const fileBuffer = Buffer.from(await dlRes.arrayBuffer());

        // h. Xử lý buffer (trực tiếp PDF hoặc trích xuất từ Zip)
        let pdfBuffer: Buffer | null = null;
        if (this.isValidPdf(fileBuffer)) {
          pdfBuffer = fileBuffer;
        } else if (this.isZip(fileBuffer)) {
          const zip = new AdmZip(fileBuffer);
          const pdfEntry = zip
            .getEntries()
            .find((e) => e.entryName.toLowerCase().endsWith('.pdf'));
          if (pdfEntry) {
            pdfBuffer = pdfEntry.getData();
          }
        }

        if (pdfBuffer && this.isValidPdf(pdfBuffer)) {
          this.logger.log(
            `[EasyInvoice] Tải thành công file PDF gốc chính thức cho HĐ ${invoiceNo || fkey} (${pdfBuffer.length} bytes)`,
          );
          return {
            success: true,
            source: 'provider_original',
            pdfBuffer,
            contentType: 'application/pdf',
          };
        }

        throw new Error('Tệp tải về từ EasyInvoice không chứa PDF hợp lệ');
      } catch (err: any) {
        this.logger.warn(
          `[EasyInvoice] Lỗi lần thử ${attempt}/${maxRetries}: ${err.message}`,
        );
        if (attempt === maxRetries) {
          return {
            success: false,
            source: 'failed',
            error: `Lỗi kết nối cổng EasyInvoice: ${err.message}`,
          };
        }
      }
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Giải Captcha hoặc tải PDF từ EasyInvoice thất bại sau các lần thử.',
    };
  }

  private isValidPdf(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 500) return false;
    return buffer.subarray(0, 4).toString() === '%PDF';
  }

  private isZip(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 4) return false;
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  }

  private getBrowserHeaders(refererUrl: string): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
      Referer: refererUrl,
    };
  }
}
