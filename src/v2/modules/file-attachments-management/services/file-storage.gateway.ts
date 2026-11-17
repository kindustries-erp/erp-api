import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { R2Service } from '@/r2/r2.service';

/** Thời hạn URL tải mặc định: 5 phút. */
export const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Cổng duy nhất của module tới R2: bọc `R2Service` (giữ nguyên) và đổi lỗi hạ tầng
 * sang exception HTTP chuẩn, không lộ thông điệp nội bộ cho client.
 */
@Injectable()
export class FileStorageGateway {
  private readonly logger = new Logger(FileStorageGateway.name);

  constructor(private readonly r2: R2Service) {}

  async upload(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.r2.uploadBuffer(key, buffer, contentType);
    } catch (error) {
      throw this.toHttpError('upload', key, error);
    }
  }

  async presignDownload(
    key: string,
    fileName: string,
    inline: boolean,
    ttlSeconds: number = DOWNLOAD_URL_TTL_SECONDS,
  ): Promise<{ url: string; expiresIn: number }> {
    try {
      const url = await this.r2.getPresignedDownloadUrl(
        key,
        ttlSeconds,
        fileName,
        inline,
      );
      return { url, expiresIn: ttlSeconds };
    } catch (error) {
      throw this.toHttpError('presign', key, error);
    }
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    try {
      return await this.r2.downloadBuffer(key);
    } catch (error) {
      throw this.toHttpError('download', key, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.r2.deleteObject(key);
    } catch (error) {
      throw this.toHttpError('delete', key, error);
    }
  }

  private toHttpError(op: string, key: string, error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`R2 ${op} thất bại (${key}): ${message}`);
    if (message.includes('not configured')) {
      return new ServiceUnavailableException('Kho lưu trữ chưa được cấu hình');
    }
    return new BadGatewayException('Không thao tác được với kho lưu trữ');
  }
}
