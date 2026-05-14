import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';

@Injectable()
export class SinvoiceService {
  private readonly logger = new Logger(SinvoiceService.name);

  constructor(private readonly configService: ConfigService) {}

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  async getConfig() {
    const url = new URL('/items/sinvoice_configs', this.directusUrl);
    url.searchParams.append('limit', '1');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });

    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không thể lấy cấu hình SInvoice');
    }

    const { data } = await res.json();
    if (!data || data.length === 0) {
      throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    }

    return data[0];
  }

  async createInvoice(invoiceData: any) {
    const config = await this.getConfig();
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const res = await fetch(`${config.apiUrl}/InvoiceWS/createInvoice/${config.supplierTaxCode}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Lỗi không xác định từ Viettel' }));
      this.logger.error(`Viettel API Error: ${JSON.stringify(error)}`);
      throw new InternalServerErrorException(error.message || 'Lỗi khi gọi API Viettel');
    }

    return await res.json();
  }

  async getInvoiceFile(invoiceNo: string, pattern: string, fileType: 'PDF' | 'XML' | 'ZIP' = 'PDF') {
    const config = await this.getConfig();
    const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');

    const payload = {
      commonDataInput: {
        supplierTaxCode: config.supplierTaxCode,
        invoiceNo: invoiceNo,
        pattern: pattern,
        fileType: fileType,
      }
    };

    const endpoint = fileType === 'PDF' 
      ? '/InvoiceUtilsWS/getInvoiceRepresentationFile' 
      : '/InvoiceUtilsWS/getInvoiceFile';

    const res = await fetch(`${config.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
       throw new InternalServerErrorException('Lỗi khi tải file hóa đơn từ Viettel');
    }

    return await res.json();
  }
}
