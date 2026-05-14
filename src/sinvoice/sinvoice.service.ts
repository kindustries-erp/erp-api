import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';

type FileType = 'PDF' | 'XML' | 'ZIP';

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
    const result = await this.directusRequest<{ data: any[] }>(
      '/items/sinvoice_configs?limit=1&filter=' +
        encodeURIComponent(JSON.stringify({ is_active: { _eq: true } })),
    );
    const row = result.data?.[0];
    if (!row) throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    return this.normalizeConfig(row);
  }

  async health() {
    const config = await this.getConfig();
    return {
      ok: true,
      environment: config.environment ?? 'demo',
      supplierTaxCode: config.supplierTaxCode,
      apiUrl: config.apiUrl,
      username: config.username,
    };
  }

  async listLocalInvoices() {
    const result = await this.directusRequest<{ data: any[] }>(
      '/items/einvoices?sort[]=-created_at&limit=50',
    );
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

  private async persistEinvoice(requestPayload: any, responsePayload: any, status: string) {
    const config = await this.getConfig();
    const data = {
      supplier_tax_code: config.supplierTaxCode,
      document_no: requestPayload?.generalInvoiceInfo?.invoiceNo ?? `DEMO-${Date.now()}`,
      invoice_no: responsePayload?.result?.invoiceNo ?? responsePayload?.invoiceNo ?? null,
      pattern: requestPayload?.generalInvoiceInfo?.templateCode ?? null,
      invoice_series: requestPayload?.generalInvoiceInfo?.invoiceSeries ?? null,
      buyer_name: requestPayload?.buyerInfo?.buyerName ?? requestPayload?.buyerInfo?.buyerLegalName ?? null,
      buyer_tax_code: requestPayload?.buyerInfo?.buyerTaxCode ?? null,
      buyer_address: requestPayload?.buyerInfo?.buyerAddressLine ?? null,
      total_amount: Number(requestPayload?.summarizeInfo?.totalAmountWithTax ?? 0),
      vat_amount: Number(requestPayload?.summarizeInfo?.totalTaxAmount ?? 0),
      status,
      viettel_transaction_id: responsePayload?.result?.transactionUuid ?? responsePayload?.transactionUuid ?? null,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: status === 'ERROR' ? JSON.stringify(responsePayload) : null,
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
