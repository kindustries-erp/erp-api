import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateViettelV2DraftDto,
  SyncViettelV2InboundDto,
} from './dto/viettel-v2.dto';

type InvoiceDirection = 'IN' | 'OUT';
type InvoiceSource = 'SINVOICE' | 'TAX_PORTAL';

type NormalizedSinvoiceConfig = {
  supplierTaxCode?: string;
  username?: string;
  password?: string;
  appKey?: string | null;
  apiUrl?: string;
  environment?: string;
  isActive?: boolean;
};

@Injectable()
export class ViettelV2Service {
  private readonly logger = new Logger(ViettelV2Service.name);

  constructor(private readonly configService: ConfigService) {}

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private normalizeSinvoiceConfig(raw: any): NormalizedSinvoiceConfig {
    return {
      ...raw,
      supplierTaxCode: raw?.supplierTaxCode ?? raw?.supplier_tax_code,
      apiUrl: raw?.apiUrl ?? raw?.api_url,
      appKey: raw?.appKey ?? raw?.app_key ?? null,
      environment: raw?.environment,
      isActive: raw?.isActive ?? raw?.is_active,
    };
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

  private async getRawConfig() {
    const result = await this.directusRequest<{ data: any }>('/items/sinvoice_configs');
    return result?.data;
  }

  private async getConfig() {
    const row = await this.getRawConfig();
    if (!row) {
      throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    }
    const config = this.normalizeSinvoiceConfig(row);
    if (!config.supplierTaxCode) {
      throw new BadRequestException('Thiếu supplier_tax_code trong cấu hình SInvoice');
    }
    return config;
  }

  private buildDraftInvoicePayload(invoiceData?: CreateViettelV2DraftDto) {
    const now = Date.now();
    const lines = (invoiceData?.lines ?? []).map((line) => {
      const quantity = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unitPrice ?? 0);
      const taxRate = Number(line.taxRate ?? 0);
      const lineAmount = quantity * unitPrice;
      const taxAmount = (lineAmount * taxRate) / 100;
      return {
        description: line.description ?? line.itemName ?? 'Invoice item',
        itemName: line.itemName ?? line.description ?? 'Invoice item',
        quantity,
        unitPrice,
        taxRate,
        lineAmount,
        taxAmount,
        totalAmountWithTax: lineAmount + taxAmount,
      };
    });

    const totalAmount = lines.reduce((sum, line) => sum + line.lineAmount, 0);
    const totalTaxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);

    return {
      documentNo: invoiceData?.documentNo ?? `VT2-${now}`,
      buyerName: invoiceData?.buyerName ?? 'Khách hàng nháp',
      buyerTaxCode: invoiceData?.buyerTaxCode ?? '',
      buyerAddress: invoiceData?.buyerAddress ?? '',
      buyerEmail: invoiceData?.buyerEmail ?? '',
      description: invoiceData?.description ?? 'Hóa đơn nháp Viettel v2',
      currencyCode: invoiceData?.currencyCode ?? 'VND',
      lines,
      totals: {
        totalAmount,
        totalTaxAmount,
        totalAmountWithTax: totalAmount + totalTaxAmount,
      },
    };
  }

  private async persistEinvoice(requestPayload: any, responsePayload: any, status: string) {
    const config = await this.getConfig();
    const draft = requestPayload?.draft ?? null;
    const data = {
      source: 'SINVOICE' as InvoiceSource,
      direction: 'OUT' as InvoiceDirection,
      supplier_tax_code: config.supplierTaxCode,
      document_no: draft?.documentNo ?? `VT2-${Date.now()}`,
      invoice_no: status === 'DRAFT' ? null : responsePayload?.result?.invoiceNo ?? null,
      buyer_name: draft?.buyerName ?? null,
      buyer_tax_code: draft?.buyerTaxCode ?? null,
      buyer_address: draft?.buyerAddress ?? null,
      seller_name: 'Công ty Liouni',
      seller_tax_code: config.supplierTaxCode,
      total_amount: Number(draft?.totals?.totalAmountWithTax ?? 0),
      vat_amount: Number(draft?.totals?.totalTaxAmount ?? 0),
      status,
      tax_status: status === 'DRAFT' ? 'LOCAL_DRAFT_ONLY' : responsePayload?.result?.status ?? null,
      viettel_transaction_id: null,
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

  private normalizeLocalPageSize(value: any) {
    const pageSize = Math.min(Math.max(Number(value ?? 15) || 15, 1), 100);
    return pageSize;
  }

  async listLocal(query: any = {}) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = this.normalizeLocalPageSize(query.pageSize);
    const offset = (page - 1) * pageSize;

    const andFilters: Record<string, any>[] = [
      { source: { _eq: 'SINVOICE' } },
      { request_payload: { _nnull: true } },
    ];

    if (query.status) {
      andFilters.push({ status: { _eq: query.status } });
    }

    const filterQuery = `&filter=${encodeURIComponent(JSON.stringify({ _and: andFilters }))}`;

    const result = await this.directusRequest<{
      data: any[];
      meta?: { filter_count?: number };
    }>(`/items/einvoices?sort[]=-created_at&limit=${pageSize}&offset=${offset}&meta=filter_count${filterQuery}`);

    const totalCount = Number(result?.meta?.filter_count ?? result?.data?.length ?? 0);

    return {
      data: result?.data ?? [],
      meta: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
      provider: 'VIETTEL_V2',
      hiddenByDefault: true,
    };
  }

  private ensureRangeNotReversed(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('issueStartDate hoặc issueEndDate không hợp lệ');
    }
    if (startDate > endDate) {
      throw new BadRequestException('issueStartDate phải nhỏ hơn hoặc bằng issueEndDate');
    }
  }

  private splitDateRangeIntoMonthlyChunks(startDate: Date, endDate: Date) {
    const chunks: { start: Date; end: Date }[] = [];
    let currentStart = new Date(startDate);
    currentStart.setHours(0, 0, 0, 0);

    while (currentStart <= endDate) {
      const maxEnd = new Date(currentStart);
      maxEnd.setMonth(maxEnd.getMonth() + 1);
      maxEnd.setDate(maxEnd.getDate() - 1);
      maxEnd.setHours(23, 59, 59, 999);

      const chunkEnd = maxEnd > endDate ? new Date(endDate) : maxEnd;
      chunkEnd.setHours(23, 59, 59, 999);

      chunks.push({
        start: new Date(currentStart),
        end: chunkEnd,
      });

      currentStart = new Date(chunkEnd);
      currentStart.setDate(currentStart.getDate() + 1);
      currentStart.setHours(0, 0, 0, 0);
    }

    return chunks;
  }

  private toYyyyMmDd(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private async callViettel(path: string, payload: any, config: NormalizedSinvoiceConfig) {
    if (!config.apiUrl || !config.username || !config.password) {
      throw new BadRequestException('Thiếu cấu hình Viettel v2 để gọi API');
    }

    const res = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
      throw new BadRequestException({
        message: `Viettel v2 request failed (${res.status})`,
        detail: data,
      });
    }

    return data;
  }

  private mapInboundInvoice(raw: any, supplierTaxCode: string, requestPayload: any, responsePayload: any) {
    const docNo =
      raw?.documentNo ??
      raw?.invoiceNo ??
      raw?.invoice_number ??
      raw?.invNo ??
      `VT2-IN-${Date.now().toString().slice(-6)}`;

    return {
      external_invoice_id:
        raw?.id ??
        raw?.invoiceId ??
        raw?.invoiceNo ??
        `${supplierTaxCode}-${docNo}`,
      document_no: docNo,
      supplier_tax_code: supplierTaxCode,
      invoice_no: raw?.invoiceNo ?? raw?.invoice_number ?? docNo,
      pattern: raw?.pattern ?? raw?.templateCode ?? null,
      invoice_series: raw?.invoiceSeries ?? raw?.seri ?? null,
      invoice_date: raw?.invoiceDate ?? raw?.issueDate ?? raw?.createdDate ?? null,
      buyer_name: raw?.buyerName ?? raw?.cusBuyer ?? null,
      buyer_tax_code: raw?.buyerTaxCode ?? null,
      buyer_address: raw?.buyerAddress ?? null,
      seller_name: raw?.sellerName ?? raw?.companyName ?? null,
      seller_tax_code: raw?.sellerTaxCode ?? supplierTaxCode,
      seller_address: raw?.sellerAddress ?? null,
      total_amount: Number(raw?.paymentAmount ?? raw?.totalAmount ?? raw?.amount ?? 0),
      vat_amount: Number(raw?.vatAmount ?? raw?.taxAmount ?? 0),
      status: raw?.status ?? 'SYNCED',
      source: 'TAX_PORTAL' as InvoiceSource,
      direction: 'IN' as InvoiceDirection,
      tax_status: raw?.invoiceStatus ?? raw?.validatedStatus ?? null,
      synced_at: new Date().toISOString(),
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: null,
    };
  }

  private extractInboundItems(response: any): any[] {
    if (Array.isArray(response?.data?.content)) return response.data.content;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.result?.content)) return response.result.content;
    if (Array.isArray(response?.result?.items)) return response.result.items;
    if (Array.isArray(response?.content)) return response.content;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private async upsertExternalEinvoice(invoice: any) {
    const externalId = invoice.external_invoice_id;
    const existing = externalId
      ? await this.directusRequest<{ data: any[] }>(
          `/items/einvoices?limit=1&filter=${encodeURIComponent(JSON.stringify({ external_invoice_id: { _eq: externalId } }))}`,
        )
      : { data: [] };

    const data = {
      document_no: invoice.document_no,
      supplier_tax_code: invoice.supplier_tax_code ?? invoice.seller_tax_code ?? invoice.buyer_tax_code ?? null,
      invoice_no: invoice.invoice_no ?? null,
      pattern: invoice.pattern ?? null,
      invoice_series: invoice.invoice_series ?? null,
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

  async health() {
    const config = await this.getConfig();
    return {
      ok: true,
      provider: 'VIETTEL_V2',
      hiddenByDefault: true,
      draftOnly: true,
      hasConfig: Boolean(config?.supplierTaxCode && config?.apiUrl),
      taxCode: config?.supplierTaxCode ?? null,
    };
  }

  async createDraft(body: CreateViettelV2DraftDto) {
    const config = await this.getConfig();
    const draft = this.buildDraftInvoicePayload(body);
    const requestPayload = {
      mode: 'DRAFT_ONLY',
      provider: 'VIETTEL_V2',
      supplierTaxCode: config.supplierTaxCode,
      draft,
      hiddenByDefault: true,
      warning: 'Không gọi Viettel phát hành. Bản ghi chỉ được lưu nội bộ để tránh phát hành nhầm.',
    };
    const responsePayload = {
      ok: true,
      provider: 'VIETTEL_V2',
      mode: 'DRAFT_ONLY',
      status: 'DRAFT',
      draftId: draft.documentNo,
      message: 'Đã lưu hóa đơn nháp nội bộ cho Viettel v2. Các thao tác ký/phát hành tiếp tục bị khóa.',
    };

    await this.persistEinvoice(requestPayload, responsePayload, 'DRAFT');

    return {
      ok: true,
      request: requestPayload,
      response: responsePayload,
    };
  }

  async syncInbound(body: SyncViettelV2InboundDto, direction: InvoiceDirection = 'IN') {
    const config = await this.getConfig();
    const supplierTaxCode = body.supplierTaxCode ?? config.supplierTaxCode;
    if (!supplierTaxCode) {
      throw new BadRequestException('Thiếu supplierTaxCode để đồng bộ hóa đơn');
    }

    const startDate = new Date(body.issueStartDate);
    const endDate = new Date(body.issueEndDate);
    this.ensureRangeNotReversed(startDate, endDate);

    const chunks = this.splitDateRangeIntoMonthlyChunks(startDate, endDate);
    this.logger.log(`Viettel v2 ${direction} sync: ${chunks.length} chunk(s) for ${supplierTaxCode}`);

    const allInvoices: any[] = [];
    const invoiceNos: string[] = [];

    for (const chunk of chunks) {
      const requestPayload = {
        taxCode: supplierTaxCode,
        pageNum: Number(body.pageNum ?? 0),
        rowPerPage: Number(body.rowPerPage ?? 100),
        issueStartDate: this.toYyyyMmDd(chunk.start),
        issueEndDate: this.toYyyyMmDd(chunk.end),
        inputSource: body.inputSource ?? (direction === 'IN' ? 1 : 2), // Giả định 1=IN, 2=OUT theo pattern thường thấy ở Viettel
        validatedStatus: body.validatedStatus ?? 0,
        invoiceStatus: body.invoiceStatus ?? 1,
        searchText: body.searchText ?? '',
      };

      const responsePayload = await this.callViettel(
        `/invoice-sync-tax/search-by-tax-xml/${supplierTaxCode}`,
        requestPayload,
        config,
      );

      const items = this.extractInboundItems(responsePayload);
      for (const raw of items) {
        const mapped = {
          ...this.mapInboundInvoice(raw, supplierTaxCode, requestPayload, responsePayload),
          direction, // Ghi đè direction đúng (IN hoặc OUT)
        };
        const persisted = await this.upsertExternalEinvoice(mapped);
        const persistedData = (persisted as any)?.data;
        if (persistedData) {
          allInvoices.push(persistedData);
          if (invoiceNos.length < 10) {
            invoiceNos.push(persistedData.invoice_no || persistedData.document_no);
          }
        }
      }
    }

    return {
      ok: true,
      provider: 'VIETTEL_V2',
      direction: 'IN',
      hiddenByDefault: true,
      count: allInvoices.length,
      synced_at: new Date().toISOString(),
      invoice_nos: invoiceNos,
      note: 'Đã đồng bộ qua Viettel v2 inbound API và upsert vào einvoices.',
    };
  }
}
