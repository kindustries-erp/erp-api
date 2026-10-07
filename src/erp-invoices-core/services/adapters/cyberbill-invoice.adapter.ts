import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  DownloadPdfParams,
  DownloadPdfResult,
  IProviderAdapter,
} from './provider-adapter.interface';
import { ProviderAdapterRegistry } from './provider-adapter.registry';
import { InvoiceCaptchaSolverService } from '../original-pdf/invoice-captcha-solver.service';

interface CyberbillCluster {
  apiUrl: string;
  portalUrl: string;
  name: string;
}

@Injectable()
export class CyberbillInvoiceAdapter implements IProviderAdapter, OnModuleInit {
  readonly providerCode = 'CYBERBILL';
  private readonly logger = new Logger(CyberbillInvoiceAdapter.name);

  private readonly clusters: CyberbillCluster[] = [
    {
      name: 'Cluster 1 (tracuu.cyberbill.vn)',
      apiUrl: 'https://bill1app.xcyber.vn',
      portalUrl: 'https://tracuu.cyberbill.vn',
    },
    {
      name: 'Cluster 2 (tracuuhoadon.cyberbill.vn)',
      apiUrl: 'https://bill2app.xcyber.vn',
      portalUrl: 'https://tracuuhoadon.cyberbill.vn',
    },
  ];

  constructor(
    private readonly registry: ProviderAdapterRegistry,
    private readonly captchaSolver: InvoiceCaptchaSolverService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  canHandle(providerCode: string): boolean {
    const code = providerCode?.toUpperCase();
    return (
      code === this.providerCode || code === 'CYBERLOTUS' || code === 'XCYBER'
    );
  }

  async downloadOriginalPdf(
    params: DownloadPdfParams,
  ): Promise<DownloadPdfResult> {
    const lookupCode = params.lookupCode?.trim();
    if (!lookupCode) {
      return {
        success: false,
        source: 'failed',
        error:
          'Không tìm thấy mã số bí mật trong XML hóa đơn CyberBill. Vui lòng mở cổng tra cứu thủ công.',
      };
    }

    const sellerTaxCode = params.sellerTaxCode?.trim();
    if (!sellerTaxCode) {
      return {
        success: false,
        source: 'failed',
        error:
          'Không tìm thấy mã số thuế bên bán để tra cứu trên cổng CyberBill.',
      };
    }

    // Duyệt qua từng cluster (Cluster 1 mặc định, Cluster 2 dự phòng khi status === 4)
    for (const cluster of this.clusters) {
      const result = await this.tryDownloadFromCluster(
        cluster,
        sellerTaxCode,
        lookupCode,
        params.invoiceNo,
      );

      if (result.success) {
        return result;
      }

      // Nếu cluster phản hồi "status 4" (Không tìm thấy, tra cứu trên link dự phòng), chuyển sang cluster tiếp theo
      if (result.error?.includes('STATUS_4_NEXT_CLUSTER')) {
        this.logger.debug(
          `[CyberBill] ${cluster.name} không có dữ liệu (status 4). Tự động chuyển sang cluster tiếp theo...`,
        );
        continue;
      }

      // Nếu là lỗi khác (như sai MST, mã bí mật không tồn tại toàn hệ thống), vẫn thử cluster 2 nếu còn
    }

    return {
      success: false,
      source: 'failed',
      error:
        'Không thể tải PDF từ hệ thống CyberBill (đã thử cả 2 cổng tracuu và tracuuhoadon). Vui lòng mở cổng tra cứu 1-chạm qua UI.',
    };
  }

  private async tryDownloadFromCluster(
    cluster: CyberbillCluster,
    sellerTaxCode: string,
    secretCode: string,
    invoiceNo?: string,
  ): Promise<DownloadPdfResult> {
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `[CyberBill] Đang kết nối ${cluster.name} (Lần ${attempt}/${maxRetries}) cho HĐ ${invoiceNo || secretCode}`,
        );

        // 1. Refresh Captcha
        const capRes = await fetch(
          `${cluster.apiUrl}/api/services/hddt/TraCuuHoaDon/RefreshCaptcha`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json-patch+json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Origin: cluster.portalUrl,
              Referer: `${cluster.portalUrl}/`,
            },
            body: '{}',
          },
        );

        if (!capRes.ok) {
          throw new Error(`RefreshCaptcha thất bại (HTTP ${capRes.status})`);
        }

        const capJson: any = await capRes.json();
        const capKey = capJson.result?.key;
        const rawImage = capJson.result?.image;

        if (!capKey || !rawImage) {
          throw new Error('Không nhận được ảnh Captcha từ CyberBill');
        }

        // 2. Giải Captcha bằng AI Vision
        let captchaText = '';
        try {
          captchaText = await this.captchaSolver.solveCaptchaBase64(
            rawImage,
            'image/jpeg',
          );
        } catch (solveErr: any) {
          this.logger.warn(`[CyberBill] Lỗi giải captcha: ${solveErr.message}`);
          if (attempt === maxRetries) {
            return {
              success: false,
              source: 'failed',
              error: `Lỗi kết nối bộ giải Captcha AI: ${solveErr.message}`,
            };
          }
          continue;
        }

        // 3. Gọi TraCuu để xác thực captcha và khởi tạo session
        const searchRes = await fetch(
          `${cluster.apiUrl}/api/services/hddt/TraCuuHoaDon/TraCuu`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json-patch+json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Origin: cluster.portalUrl,
              Referer: `${cluster.portalUrl}/`,
            },
            body: JSON.stringify({
              key: capKey,
              captcha: captchaText,
              doanhNghiep_MST: sellerTaxCode,
              maSoBiMat: secretCode,
            }),
          },
        );

        if (!searchRes.ok) {
          throw new Error(`TraCuu thất bại (HTTP ${searchRes.status})`);
        }

        const searchJson: any = await searchRes.json();
        const searchResult = searchJson.result;

        // Trạng thái 4: Cần chuyển sang link dự phòng (Cluster 2)
        if (searchResult?.status === 4) {
          return {
            success: false,
            source: 'failed',
            error: 'STATUS_4_NEXT_CLUSTER',
          };
        }

        // Trạng thái 2: Captcha không đúng -> retry
        if (searchResult?.status === 2) {
          this.logger.warn(
            `[CyberBill] Captcha "${captchaText}" bị từ chối ở lần thử ${attempt}. Đang thử lại...`,
          );
          continue;
        }

        // Trạng thái khác 1: Lỗi nghiệp vụ
        if (searchResult?.status !== 1) {
          const msg = searchResult?.message || 'Không tìm thấy hóa đơn';
          return {
            success: false,
            source: 'failed',
            error: `CyberBill phản hồi: "${msg}".`,
          };
        }

        // 4. Gọi DownloadPdf với session key trả về từ TraCuu
        const sessionKey = searchResult?.key || capKey;
        const dlRes = await fetch(
          `${cluster.apiUrl}/api/services/hddt/TraCuuHoaDon/DownloadPdf`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json-patch+json',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              Origin: cluster.portalUrl,
              Referer: `${cluster.portalUrl}/`,
            },
            body: JSON.stringify({
              key: sessionKey,
              doanhNghiep_MST: sellerTaxCode,
              maSoBiMat: secretCode,
            }),
          },
        );

        if (!dlRes.ok) {
          throw new Error(`DownloadPdf thất bại (HTTP ${dlRes.status})`);
        }

        const dlJson: any = await dlRes.json();
        const fileInfo = dlJson.result || dlJson;

        // Trường hợp A: Trả về fileToken -> Tải từ /File/DownloadTempFile
        if (fileInfo?.fileToken) {
          const downloadUrl = `${cluster.apiUrl}/File/DownloadTempFile?fileType=${encodeURIComponent(
            fileInfo.fileType || 'text/xml',
          )}&fileToken=${encodeURIComponent(fileInfo.fileToken)}&fileName=${encodeURIComponent(
            fileInfo.fileName || 'invoice.pdf',
          )}`;

          const fileRes = await fetch(downloadUrl);
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer();
            const pdfBuffer = Buffer.from(arrayBuffer);
            if (
              pdfBuffer.length > 500 &&
              pdfBuffer.subarray(0, 4).toString() === '%PDF'
            ) {
              this.logger.log(
                `[CyberBill] Tải thành công PDF gốc cho HĐ ${invoiceNo || secretCode} từ ${cluster.name} (${pdfBuffer.length} bytes)`,
              );
              return {
                success: true,
                pdfBuffer,
                source: 'provider_original',
                contentType: 'application/pdf',
              };
            }
          }
        }

        // Trường hợp B: Trả về base64 trực tiếp
        const base64Data = fileInfo?.base64 || fileInfo?.fileData;
        if (base64Data) {
          const pdfBuffer = Buffer.from(base64Data, 'base64');
          if (
            pdfBuffer.length > 500 &&
            pdfBuffer.subarray(0, 4).toString() === '%PDF'
          ) {
            this.logger.log(
              `[CyberBill] Tải thành công PDF gốc qua Base64 (${pdfBuffer.length} bytes)`,
            );
            return {
              success: true,
              pdfBuffer,
              source: 'provider_original',
              contentType: 'application/pdf',
            };
          }
        }
      } catch (err: any) {
        this.logger.error(
          `[CyberBill] Lỗi tại ${cluster.name} (Lần ${attempt}): ${err.message}`,
        );
        if (attempt === maxRetries) {
          return {
            success: false,
            source: 'failed',
            error: err.message,
          };
        }
      }
    }

    return {
      success: false,
      source: 'failed',
      error: 'Giải Captcha thất bại sau các lần thử.',
    };
  }
}
