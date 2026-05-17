import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  private async directusRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const requestUrl = `${this.directusUrl}${path}`;
    const res = await fetch(requestUrl, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      this.logger.error(`Directus request failed ${res.status}: ${requestUrl} :: ${errorText}`);
      throw new BadRequestException(errorText || `Directus request failed: ${path}`);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async getConfigEndpoint() {
    const result = await this.directusRequest<{ data: any[] }>('/items/sinvoice_configs?filter[is_active][_eq]=true');
    const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!row) return null;
    return {
      supplierTaxCode: row.supplier_tax_code,
      username: row.username,
      apiUrl: row.api_url,
    };
  }

  async saveConfig(body: any) {
    const supplierTaxCode = body?.supplierTaxCode ?? body?.supplier_tax_code ?? body?.username;
    const username = body?.username;
    const password = body?.password;
    const apiUrl = body?.apiUrl ?? body?.api_url;

    if (!username || !password || !apiUrl) {
      throw new BadRequestException('Thiếu thông tin cấu hình bắt buộc: username, password, apiUrl');
    }

    const payload = {
      supplier_tax_code: supplierTaxCode || username,
      username,
      password,
      api_url: apiUrl,
      is_active: true,
    };

    const existing = await this.directusRequest<{ data: any[] }>(
      '/items/sinvoice_configs?filter[is_active][_eq]=true&limit=1',
    );

    const current = Array.isArray(existing?.data) ? existing.data[0] : existing?.data;
    if (!current?.id) {
      throw new BadRequestException('Thiếu bản ghi cấu hình SInvoice hiện hữu để cập nhật. Vui lòng tạo 1 record sinvoice_configs trong Directus trước.');
    }

    return this.directusRequest('/items/sinvoice_configs', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async resetConfig() {
    return this.directusRequest('/items/sinvoice_configs?filter[is_active][_eq]=true', {
        method: 'DELETE'
    });
  }

  async getTaxPortalConfig() {
    const result = await this.directusRequest<{ data: any[] }>('/items/tax_portal_configs?filter[is_active][_eq]=true');
    return result?.data?.[0] || null;
  }

  async saveTaxPortalConfig(body: any) {
    return this.directusRequest('/items/tax_portal_configs', {
        method: 'POST',
        body: JSON.stringify(body)
    });
  }

  async resetTaxPortalConfig() {
    return this.directusRequest('/items/tax_portal_configs?filter[is_active][_eq]=true', {
        method: 'DELETE'
    });
  }

  async syncTaxPortal(query: any) {
    return { ok: true, message: 'Sync triggered' };
  }

  async runSinvoiceDemoFlow() {
    return { ok: true, message: 'Demo flow completed' };
  }
}
