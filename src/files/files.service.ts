import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDirectus } from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  async upload(file: any, userToken: string) {
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');

    try {
      // Sử dụng FormData chuẩn của Node.js (có sẵn từ Node 18+)
      const formData = new FormData();
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, file.originalname);

      const response = await fetch(`${directusUrl}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        this.logger.error(`Directus upload error: ${errorData}`);
        throw new Error(`Directus error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      this.logger.error('Lỗi khi upload file lên Directus', error);
      throw new InternalServerErrorException('Không thể upload file');
    }
  }

  async getFileStream(id: string, userToken?: string) {
    const directusUrl = this.configService.getOrThrow<string>('DIRECTUS_URL');
    const adminToken = this.configService.get<string>('DIRECTUS_ADMIN_TOKEN');

    // Ưu tiên dùng token của user, nếu không có thì dùng admin token để fetch file
    const token = userToken || adminToken;

    try {
      const response = await fetch(`${directusUrl}/assets/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Directus error: ${response.statusText}`);
      }

      return {
        stream: response.body,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      };
    } catch (error) {
      this.logger.error(`Lỗi khi lấy file ${id} từ Directus`, error);
      throw new InternalServerErrorException('Không thể tải file');
    }
  }
}
