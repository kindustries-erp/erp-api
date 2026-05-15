import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';

type FileType = 'PDF' | 'XML' | 'ZIP';
type InvoiceSource = 'SINVOICE' | 'TAX_PORTAL';
type InvoiceDirection = 'IN' | 'OUT';

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

  private normalizeConfig(raw: any) {
    return {
      ...raw,
      supplierTaxCode: raw.supplierTaxCode ?? raw.supplier_tax_code,
      apiUrl: raw.apiUrl ?? raw.api_url,
      appKey: raw.appKey ?? raw.app_key,
    };
  }

  private normalizeTaxPortalConfig(raw: any) {
    return {
      ...raw,
      taxCode: raw.taxCode ?? raw.tax_code,
      providerName: raw.providerName ?? raw.provider_name,
      apiUrl: raw.apiUrl ?? raw.api_url,
    };
  }

  private authHeader(config: any) {
    return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
  }

  private async directusRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.directusUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) await throwDirectusResponseError(res, `Directus request failed: ${path}`);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  async getConfig() {
    const row = await this.getRawConfig();
    if (!row) throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    return this.normalizeConfig(row);
  }

  async getRawConfig() {
    const result = await this.directusRequest<{ data: any }>('/items/sinvoice_configs');
    return result?.data;
  }

  async getConfigEndpoint() {
    const row = await this.getRawConfig();
    if (!row || !row.supplier_tax_code) return null;
    return {
      supplierTaxCode: row.supplier_tax_code,
      username: row.username,
      password: row.password,
      apiUrl: row.api_url,
      environment: row.environment,
    };
  }

  async saveConfig(dto: any) {
    const data = {
      supplier_tax_code: dto.supplierTaxCode ?? dto.supplier_tax_code,
      username: dto.username,
      password: dto.password,
      app_key: dto.appKey ?? dto.app_key ?? null,
      api_url: dto.apiUrl ?? dto.api_url ?? 'https://demo-sinvoice.viettel.vn:8443/InvoiceAPI',
      environment: dto.environment ?? 'demo',
      is_active: true,
    };
    const res = await this.directusRequest('/items/sinvoice_configs', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { ok: true, data: res };
  }

  async resetConfig() {
    const data = {
      supplier_tax_code: null,
      username: null,
      password: null,
      app_key: null,
      api_url: null,
      environment: null,
      is_active: false,
    };
    await this.directusRequest('/items/sinvoice_configs', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { ok: true };
  }

  async getTaxPortalRawConfig() {
    const result = await this.directusRequest<{ data: any }>('/items/tax_portal_configs');
    return result?.data ?? null;
  }

  async getTaxPortalConfig() {
    const row = await this.getTaxPortalRawConfig();
    if (!row || (!row.username && !row.tax_code && !row.api_url && !row.is_active)) return null;
    return this.normalizeTaxPortalConfig(row);
  }

  async saveTaxPortalConfig(dto: any) {
    const data = {
      tax_code: dto.taxCode ?? dto.tax_code,
      username: dto.username,
      password: dto.password,
      provider_name: dto.providerName ?? dto.provider_name ?? 'VIETTEL_TAX_PORTAL',
      api_url: dto.apiUrl ?? dto.api_url ?? null,
      is_active: dto.isActive ?? dto.is_active ?? true,
    };

    const res = await this.directusRequest('/items/tax_portal_configs', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return { ok: true, data: res };
  }

  async resetTaxPortalConfig() {
    await this.directusRequest('/items/tax_portal_configs', {
      method: 'PATCH',
      body: JSON.stringify({
        tax_code: null,
        username: null,
        password: null,
        provider_name: 'VIETTEL_TAX_PORTAL',
        api_url: null,
        is_active: false,
      }),
    });
    return { ok: true };
  }

  async health() {
    const config = await this.getConfig();
    const taxPortalConfig = await this.getTaxPortalConfig();
    return {
      ok: true,
      environment: config.environment ?? 'demo',
      supplierTaxCode: config.supplierTaxCode,
      apiUrl: config.apiUrl,
      username: config.username,
      taxPortalConfigured: Boolean(taxPortalConfig?.username),
      taxPortalApiUrl: taxPortalConfig?.apiUrl ?? null,
      taxPortalTaxCode: taxPortalConfig?.taxCode ?? null,
    };
  }

  async listLocalInvoices(query: any = {}) {
    const filters: string[] = [];
    if (query.source) filters.push(`"source":{"_eq":"${query.source}"}`);
    if (query.direction) filters.push(`"direction":{"_eq":"${query.direction}"}`);
    const filter = filters.length > 0 ? `&filter={"_and":[${filters.join(',')}]}` : '';
    const result = await this.directusRequest<{ data: any[] }>(`/items/einvoices?sort[]=-created_at&limit=100${filter}`);
    return result.data ?? [];
  }

  private async callViettel(endpoint: string, body: any, expectJson = true) {
    const config = await this.getConfig();
    const res = await fetch(`${config.apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(config),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let payload: any = text;
    if (expectJson && text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }
    if (!res.ok) {
      this.logger.error(`Viettel ${endpoint} failed ${res.status}: ${text}`);
      throw new InternalServerErrorException(payload?.message ?? payload?.error ?? 'Lỗi khi gọi API Viettel');
    }
    return payload;
  }

  private buildTaxPortalStubInvoices(direction: InvoiceDirection, cfg: any, startDate?: string, endDate?: string) {
    const now = new Date().toISOString();
    const prefix = direction === 'IN' ? 'TIN' : 'TOUT';
    const partnerName = direction === 'IN' ? 'Nhà cung cấp mẫu từ CQT' : 'Khách hàng mẫu từ CQT';
    return [
      {
        external_invoice_id: `${prefix}-${Date.now()}`,
        document_no: `${prefix}-${Date.now().toString().slice(-6)}`,
        invoice_no: `${direction === 'IN' ? 'MV' : 'BR'}-${Date.now().toString().slice(-5)}`,
        invoice_date: now,
        source: 'TAX_PORTAL',
        direction,
        tax_status: 'SYNCED_STUB',
        status: 'SYNCED',
        seller_name: direction === 'IN' ? partnerName : 'Công ty Liouni',
        seller_tax_code: direction === 'IN' ? '0312345678' : cfg?.taxCode ?? null,
        seller_address: 'Việt Nam',
        buyer_name: direction === 'OUT' ? partnerName : 'Công ty Liouni',
        buyer_tax_code: direction === 'OUT' ? '0309876543' : cfg?.taxCode ?? null,
        buyer_address: 'Việt Nam',
        total_amount: direction === 'IN' ? 2200000 : 3300000,
        vat_amount: direction === 'IN' ? 200000 : 300000,
        request_payload: { startDate, endDate, direction },
        response_payload: { note: 'Stub data chờ tích hợp endpoint CQT thật' },
        synced_at: now,
      },
    ];
  }

  async syncTaxPortal(query: any = {}) {
    const config = await this.getTaxPortalConfig();
    if (!config?.username || !config?.password) {
      throw new BadRequestException('Chưa cấu hình tài khoản cổng thuế');
    }

    const direction = (query.direction ?? 'OUT') as InvoiceDirection;
    if (!['IN', 'OUT'].includes(direction)) {
      throw new BadRequestException('direction phải là IN hoặc OUT');
    }

    const invoices = this.buildTaxPortalStubInvoices(direction, config, query.startDate, query.endDate);
    const saved = [] as any[];
    for (const invoice of invoices) {
      const persisted = await this.upsertExternalEinvoice(invoice);
      saved.push(persisted);
    }

    return {
      ok: true,
      source: 'TAX_PORTAL',
      direction,
      count: saved.length,
      items: saved,
      note: 'Đang dùng stub để khóa luồng ERP trước khi map endpoint CQT thật từ tài liệu Viettel.',
    };
  }

  async createInvoice(invoiceData?: any) {
    const config = await this.getConfig();
    const payload = invoiceData && Object.keys(invoiceData).length > 0 ? invoiceData : this.buildDemoInvoicePayload(config);
    try {
      const response = await this.callViettel(`/InvoiceWS/createInvoice/${config.supplierTaxCode}`, payload);
      await this.persistEinvoice(payload, response, 'ISSUED');
      return { ok: true, request: payload, response };
    } catch (error: any) {
      await this.persistEinvoice(payload, { error: error.message }, 'ERROR');
      throw error;
    }
  }

  async cancelInvoice(dto: any) {
    const config = await this.getConfig();
    const payload = new URLSearchParams({
      supplierTaxCode: dto.supplierTaxCode ?? config.supplierTaxCode,
      invoiceNo: dto.invoiceNo,
      strIssueDate: dto.strIssueDate,
      additionalReferenceDesc: dto.additionalReferenceDesc ?? 'ERP demo cancel',
      additionalReferenceDate: dto.additionalReferenceDate ?? dto.strIssueDate,
    }).toString();
    return this.callViettel('/InvoiceWS/cancelTransactionInvoice', payload);
  }

  async getInvoiceFile(invoiceNo: string, pattern: string, fileType: FileType = 'PDF') {
    if (!invoiceNo || !pattern) throw new BadRequestException('invoiceNo và pattern là bắt buộc');
    const config = await this.getConfig();
    const payload = {
      commonDataInput: {
        supplierTaxCode: config.supplierTaxCode,
        invoiceNo,
        pattern,
        fileType,
      },
    };
    const endpoint = fileType === 'PDF' || fileType === 'ZIP'
      ? '/InvoiceUtilsWS/getInvoiceRepresentationFile'
      : '/InvoiceUtilsWS/getInvoiceFile';
    return this.callViettel(endpoint, payload);
  }

  async getInvoices(query: any = {}) {
    const config = await this.getConfig();
    const now = new Date();
    const start = query.startDate ?? new Date(now.getTime() - 30 * 86400000).toISOString();
    const end = query.endDate ?? now.toISOString();
    const payload = {
      getInvoiceInput: {
        startDate: start,
        endDate: end,
        invoiceType: query.invoiceType ?? '',
        rowPerPage: Number(query.rowPerPage ?? 20),
        pageNum: Number(query.pageNum ?? 1),
        templateCode: query.templateCode ?? '',
        contractNo: query.contractNo ?? '',
        contractId: query.contractId ?? '',
        buyerTaxCode: query.buyerTaxCode ?? '',
        invoiceSeri: query.invoiceSeri ?? '',
      },
    };
    return this.callViettel(`/InvoiceUtilsWS/getInvoices/${config.supplierTaxCode}`, payload);
  }

  async fullDemoFlow() {
    const health = await this.health();
    let create: any;
    try {
      create = await this.createInvoice();
    } catch (error: any) {
      create = { ok: false, message: error.message };
    }
    let list: any;
    try {
      list = await this.getInvoices({ rowPerPage: 5 });
    } catch (error: any) {
      list = { ok: false, message: error.message };
    }
    return { health, create, list };
  }

  private async upsertExternalEinvoice(invoice: any) {
    const externalId = invoice.external_invoice_id;
    const existing = externalId
      ? await this.directusRequest<{ data: any[] }>(`/items/einvoices?limit=1&filter={"external_invoice_id":{"_eq":"${externalId}"}}`)
      : { data: [] };

    const data = {
      document_no: invoice.document_no,
      supplier_tax_code: invoice.supplier_tax_code ?? invoice.seller_tax_code ?? invoice.buyer_tax_code ?? null,
      invoice_no: invoice.invoice_no ?? null,
      invoice_date: invoice.invoice_date ?? null,
      buyer_name: invoice.buyer_name ?? null,
      buyer_tax_code: invoice.buyer_tax_code ?? null,
      buyer_address: invoice.buyer_address ?? null,
      seller_name: invoice.seller_name ?? null,
      seller_tax_code: invoice.seller_tax_code ?? null,
      seller_address: invoice.seller_address ?? null,
      total_amount: Number(invoice.total_amount ?? 0),
      vat_amount: Number(invoice.vat_amount ?? 0),
      status: invoice.status ?? 'SYNCED',
      source: invoice.source ?? 'TAX_PORTAL',
      direction: invoice.direction ?? null,
      tax_status: invoice.tax_status ?? null,
      external_invoice_id: externalId ?? null,
      synced_at: invoice.synced_at ?? new Date().toISOString(),
      request_payload: invoice.request_payload ?? null,
      response_payload: invoice.response_payload ?? null,
      error_message: invoice.error_message ?? null,
    };

    if (existing.data?.[0]?.id) {
      return this.directusRequest(`/items/einvoices/${existing.data[0].id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }

    return this.directusRequest('/items/einvoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  private async persistEinvoice(requestPayload: any, responsePayload: any, status: string) {
    const config = await this.getConfig();
    const data = {
      source: 'SINVOICE' as InvoiceSource,
      direction: 'OUT' as InvoiceDirection,
      supplier_tax_code: config.supplierTaxCode,
      document_no: requestPayload?.generalInvoiceInfo?.invoiceNo ?? `DEMO-${Date.now()}`,
      invoice_no: responsePayload?.result?.invoiceNo ?? responsePayload?.invoiceNo ?? null,
      pattern: requestPayload?.generalInvoiceInfo?.templateCode ?? null,
      invoice_series: requestPayload?.generalInvoiceInfo?.invoiceSeries ?? null,
      buyer_name: requestPayload?.buyerInfo?.buyerName ?? requestPayload?.buyerInfo?.buyerLegalName ?? null,
      buyer_tax_code: requestPayload?.buyerInfo?.buyerTaxCode ?? null,
      buyer_address: requestPayload?.buyerInfo?.buyerAddressLine ?? null,
      seller_name: 'Công ty Liouni',
      seller_tax_code: config.supplierTaxCode,
      total_amount: Number(requestPayload?.summarizeInfo?.totalAmountWithTax ?? 0),
      vat_amount: Number(requestPayload?.summarizeInfo?.totalTaxAmount ?? 0),
      status,
      tax_status: responsePayload?.result?.status ?? null,
      viettel_transaction_id: responsePayload?.result?.transactionUuid ?? responsePayload?.transactionUuid ?? null,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: status === 'ERROR' ? JSON.stringify(responsePayload) : null,
      synced_at: new Date().toISOString(),
    };
    await this.directusRequest('/items/einvoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  private buildDemoInvoicePayload(config: any) {
    const suffix = Date.now().toString().slice(-8);
    return {
      generalInvoiceInfo: {
        invoiceType: '01GTKT',
        templateCode: '01GTKT0/001',
        invoiceSeries: 'AA/23E',
        currencyCode: 'VND',
        adjustmentType: '1',
        paymentStatus: true,
        paymentType: 'TM/CK',
        paymentTypeName: 'Tiền mặt/Chuyển khoản',
      },
      sellerInfo: { sellerTaxCode: config.supplierTaxCode },
      buyerInfo: {
        buyerName: 'Khách hàng Demo ERP',
        buyerLegalName: 'Công ty Demo ERP Liouni',
        buyerTaxCode: '0100109106',
        buyerAddressLine: 'Hà Nội',
        buyerPhoneNumber: '0900000000',
        buyerEmail: 'demo@example.com',
      },
      payments: [{ paymentMethodName: 'TM/CK' }],
      itemInfo: [
        {
          lineNumber: 1,
          itemCode: `DEMO-${suffix}`,
          itemName: 'Dịch vụ demo tích hợp SInvoice',
          unitName: 'Lần',
          unitPrice: 100000,
          quantity: 1,
          itemTotalAmountWithoutTax: 100000,
          taxPercentage: 10,
          taxAmount: 10000,
          itemTotalAmountWithTax: 110000,
        },
      ],
      summarizeInfo: {
        sumOfTotalLineAmountWithoutTax: 100000,
        totalAmountWithoutTax: 100000,
        totalTaxAmount: 10000,
        totalAmountWithTax: 110000,
        totalAmountWithTaxInWords: 'Một trăm mười nghìn đồng',
      },
    };
  }
}
