import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import AdmZip from 'adm-zip';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';

const DOWNLOAD_PDF_TAG =
  /<TTruong>DownloadPdf<\/TTruong>\s*<KDLieu>[^<]*<\/KDLieu>\s*<DLieu>([^<]+)<\/DLieu>/;
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$)/i;

/**
 * Tải PDF gốc bằng link `DownloadPdf` nhúng trong XML hóa đơn (TTKhac).
 * Dùng làm phương án dự phòng khi NCC không có adapter riêng.
 */
@Injectable()
export class XmlDownloadLinkAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'XML_LINK';
  private readonly logger = new Logger(XmlDownloadLinkAdapter.name);

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
    const link = this.extractLink(params.xmlContent);
    if (!link) {
      return this.failed(
        'Không có XML hoặc XML không chứa link tải PDF (DownloadPdf)',
      );
    }

    const url = this.toHttpsUrl(link);
    if (!url) {
      return this.failed(
        'Link tải PDF trong XML không hợp lệ hoặc không dùng HTTPS',
      );
    }

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/pdf,application/zip,*/*' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        return this.failed(
          `Tải PDF từ link trong XML thất bại (HTTP ${res.status})`,
        );
      }

      const body = Buffer.from(await res.arrayBuffer());
      const pdfBuffer = this.extractPdf(body);
      if (!pdfBuffer) {
        return this.failed('Nội dung tải về không chứa file PDF hợp lệ');
      }

      this.logger.log(
        `Downloaded PDF for invoice ${params.invoiceNo} from XML link (size: ${pdfBuffer.length} bytes)`,
      );
      return {
        success: true,
        source: 'provider_original',
        pdfBuffer,
        contentType: 'application/pdf',
      };
    } catch (err: any) {
      this.logger.error(`XML link adapter error: ${err.message}`);
      return this.failed(`Lỗi tải PDF từ link trong XML: ${err.message}`);
    }
  }

  private extractLink(xmlContent?: string | null): string | null {
    if (!xmlContent) return null;
    const match = xmlContent.match(DOWNLOAD_PDF_TAG);
    return match ? match[1].trim().replace(/&amp;/g, '&') : null;
  }

  private toHttpsUrl(raw: string): string | null {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || PRIVATE_HOST.test(url.hostname)) {
      return null;
    }
    return url.toString();
  }

  private extractPdf(body: Buffer): Buffer | null {
    if (this.isPdf(body)) return body;

    const isZip = body.length >= 4 && body[0] === 0x50 && body[1] === 0x4b;
    if (!isZip) return null;

    const entry = new AdmZip(body)
      .getEntries()
      .find(
        (e) => !e.isDirectory && e.entryName.toLowerCase().endsWith('.pdf'),
      );
    if (!entry) return null;

    const data = entry.getData();
    return this.isPdf(data) ? data : null;
  }

  private isPdf(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF';
  }

  private failed(error: string): DownloadPdfResult {
    return { success: false, source: 'failed', error };
  }
}
