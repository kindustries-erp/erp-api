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

type DraftInvoiceLineInput = {
  description?: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  taxRate?: number;
  tax_rate?: number;
};

type DraftInvoiceInput = {
  documentNo?: string;
  document_no?: string;
  buyerName?: string;
  buyer_name?: string;
  buyerTaxCode?: string;
  buyer_tax_code?: string;
  buyerAddress?: string;
  buyer_address?: string;
  buyerEmail?: string;
  buyer_email?: string;
  description?: string;
  currencyCode?: string;
  currency_code?: string;
  lines?: DraftInvoiceLineInput[];
};

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
      gdtJwt: raw.gdtJwt ?? raw.gdt_jwt,
      gdtCookie: raw.gdtCookie ?? raw.gdt_cookie,
    };
  }

  private authHeader(config: any) {
    return `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
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

  private buildConnectionResult(params: {
    provider: 'SINVOICE' | 'TAX_PORTAL';
    ok: boolean;
    message: string;
    checkedAt?: string;
    detail?: any;
  }) {
    return {
      provider: params.provider,
      ok: params.ok,
      message: params.message,
      checkedAt: params.checkedAt ?? new Date().toISOString(),
      detail: params.detail ?? null,
    };
  }

  private async testSinvoiceConnectionWithConfig(config: any) {
    if (!config?.apiUrl || !config?.username || !config?.password || !config?.supplierTaxCode) {
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: false,
        message: 'Thiếu thông tin cấu hình SInvoice để kiểm tra kết nối',
      });
    }

    try {
      const res = await fetch(`${config.apiUrl}/InvoiceWS/getInvoiceList`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          supplierTaxCode: config.supplierTaxCode,
          pageNo: 1,
          pageSize: 1,
        }),
      });
      const text = await res.text();
      let detail: any = text;
      try {
        detail = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok) {
        return this.buildConnectionResult({
          provider: 'SINVOICE',
          ok: false,
          message: `Kết nối SInvoice thất bại (${res.status})`,
          detail,
        });
      }
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: true,
        message: 'Đã kết nối thành công tới SInvoice',
        detail: { status: res.status },
      });
    } catch (error: any) {
      return this.buildConnectionResult({
        provider: 'SINVOICE',
        ok: false,
        message: `Không thể kết nối SInvoice: ${error?.message ?? 'Unknown error'}`,
      });
    }
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
    const connection = await this.testSinvoiceConnectionWithConfig({
      supplierTaxCode: data.supplier_tax_code,
      username: data.username,
      password: data.password,
      apiUrl: data.api_url,
    });
    return { ok: true, data: res, connection };
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

  private async testTaxPortalConnectionWithConfig(config: any) {
    if (!config?.username || !config?.password) {
      return this.buildConnectionResult({
        provider: 'TAX_PORTAL',
        ok: false,
        message: 'Thiếu thông tin cấu hình cổng thuế để kiểm tra kết nối',
      });
    }

    if (!config?.apiUrl) {
      return this.buildConnectionResult({
        provider: 'TAX_PORTAL',
        ok: true,
        message: 'Đã lưu cấu hình cổng thuế. Chưa có API URL thật nên tạm xác nhận ở mức sẵn sàng đồng bộ stub.',
        detail: { mode: 'stub-ready' },
      });
    }

    try {
      const res = await fetch(config.apiUrl, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
          Accept: 'application/json,text/plain,*/*',
        },
      });
      const text = await res.text();
      let detail: any = text;
      try {
        detail = text ? JSON.parse(text) : null;
      } catch {}
      if (!res.ok) {
        return this.buildConnectionResult({
          provider: 'TAX_PORTAL',
          ok: false,
          message: `Kết nối cổng thuế thất bại (${res.status})`,
          detail,
        });
      }
      return this.buildConnectionResult({
        provider: 'TAX_PORTAL',
        ok: true,
        message: 'Đã kết nối thành công tới cổng thuế/Viettel integration',
        detail: { status: res.status },
      });
    } catch (error: any) {
      return this.buildConnectionResult({
        provider: 'TAX_PORTAL',
        ok: false,
        message: `Không thể kết nối cổng thuế: ${error?.message ?? 'Unknown error'}`,
      });
    }
  }

  async saveTaxPortalConfig(dto: any) {
    const data = {
      tax_code: dto.taxCode ?? dto.tax_code,
      username: dto.username,
      password: dto.password,
      provider_name: dto.providerName ?? dto.provider_name ?? 'VIETTEL_TAX_PORTAL',
      api_url: dto.apiUrl ?? dto.api_url ?? null,
      gdt_jwt: dto.gdtJwt ?? dto.gdt_jwt ?? null,
      gdt_cookie: dto.gdtCookie ?? dto.gdt_cookie ?? null,
      is_active: dto.isActive ?? dto.is_active ?? true,
    };

    const res = await this.directusRequest('/items/tax_portal_configs', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    const connection = await this.testTaxPortalConnectionWithConfig({
      taxCode: data.tax_code,
      username: data.username,
      password: data.password,
      apiUrl: data.api_url,
    });
    return { ok: true, data: res, connection };
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
        gdt_jwt: null,
        gdt_cookie: null,
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
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize ?? 15) || 15, 1), 100);
    const offset = (page - 1) * pageSize;

    const andFilters: Record<string, any>[] = [];
    if (query.source) andFilters.push({ source: { _eq: query.source } });
    if (query.direction) andFilters.push({ direction: { _eq: query.direction } });

    if (query.startDate) {
      andFilters.push({ invoice_date: { _gte: new Date(query.startDate).toISOString() } });
    }
    if (query.endDate) {
      const endDate = new Date(query.endDate);
      endDate.setHours(23, 59, 59, 999);
      andFilters.push({ invoice_date: { _lte: endDate.toISOString() } });
    }

    if (query.search) {
      const keyword = String(query.search).trim();
      const searchFields = [
        'document_no',
        'invoice_no',
        'seller_name',
        'buyer_name',
        'buyer_tax_code',
        'seller_tax_code',
      ];
      andFilters.push({
        _or: searchFields.map((field) => ({ [field]: { _icontains: keyword } })),
      });
    }

    const filterObject = andFilters.length > 0 ? { _and: andFilters } : null;
    const filterQuery = filterObject ? `&filter=${encodeURIComponent(JSON.stringify(filterObject))}` : '';

    const result = await this.directusRequest<{
      data: any[];
      meta?: { filter_count?: number };
    }>(
      `/items/einvoices?sort[]=-invoice_date&sort[]=-created_at&limit=${pageSize}&offset=${offset}&meta=filter_count${filterQuery}`,
    );

    const aggregateQuery = filterObject
      ? `&filter=${encodeURIComponent(JSON.stringify(filterObject))}`
      : '';
    const totalsResult = await this.directusRequest<{
      data: Array<{ sum: { total_amount: number; vat_amount: number } }>;
    }>(`/items/einvoices?aggregate=${encodeURIComponent(JSON.stringify({ sum: ['total_amount', 'vat_amount'] }))}${aggregateQuery}`);

    const items = result.data ?? [];
    const totalCount = Number(result.meta?.filter_count ?? items.length ?? 0);
    const totals = totalsResult.data?.[0]?.sum ?? { total_amount: 0, vat_amount: 0 };

    return {
      data: items,
      meta: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
        sum_total_amount: Number(totals.total_amount || 0),
        sum_vat_amount: Number(totals.vat_amount || 0),
      },
    };
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

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private splitDateRangeIntoMonthlyChunks(startDate: Date, endDate: Date) {
    const chunks: { start: Date; end: Date }[] = [];
    let currentStart = new Date(startDate);

    while (currentStart <= endDate) {
      // End of current month
      const currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0);
      
      const chunkEnd = currentEnd > endDate ? new Date(endDate) : currentEnd;
      
      // Set to end of day
      chunkEnd.setHours(23, 59, 59, 999);
      
      chunks.push({
        start: new Date(currentStart),
        end: chunkEnd,
      });

      // Move to first day of next month
      currentStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 1);
      currentStart.setHours(0, 0, 0, 0);
    }

    return chunks;
  }

  async syncTaxPortal(query: any = {}) {
    const config = await this.getTaxPortalConfig();
    if (!config?.gdtJwt || !config?.gdtCookie) {
      throw new BadRequestException('Chưa cấu hình Token và Cookie Tổng cục Thuế trên giao diện');
    }

    const direction = (query.direction ?? 'OUT') as InvoiceDirection;
    if (!['IN', 'OUT'].includes(direction)) {
      throw new BadRequestException('direction phải là IN hoặc OUT');
    }

    // Validate pageSize (size)
    let size = Number(query.pageSize ?? query.size ?? 15);
    if (![15, 30, 50].includes(size)) {
      size = 15;
    }

    const now = new Date();
    const endDate = query.endDate ? new Date(query.endDate) : now;
    const startDate = query.startDate ? new Date(query.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const chunks = this.splitDateRangeIntoMonthlyChunks(startDate, endDate);
    this.logger.log(`Syncing Tax Portal in ${chunks.length} chunks for ${direction}`);

    const allInvoices: any[] = [];
    const invoiceNos: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Throttling: Random delay 3-5s between chunks (except first)
      if (i > 0) {
        const delay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
        this.logger.log(`Throttling: Sleeping ${delay}ms before next chunk...`);
        await this.sleep(delay);
      }

      const chunkInvoices = await this.fetchFromGdtApi(
        direction, 
        config, 
        chunk.start, 
        chunk.end, 
        { ...query, size }
      );

      for (const invoice of chunkInvoices) {
        const persisted = await this.upsertExternalEinvoice(invoice);
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
      source: 'TAX_PORTAL',
      direction,
      count: allInvoices.length,
      synced_at: new Date().toISOString(),
      invoice_nos: invoiceNos,
      note: `Đồng bộ dữ liệu trực tiếp từ Tổng cục Thuế qua ${chunks.length} lần gọi.`,
    };
  }

  private async fetchFromGdtApi(
    direction: InvoiceDirection, 
    config: any, 
    start: Date, 
    end: Date, 
    query: any = {}
  ) {
    const endpoint = direction === 'IN' ? 'purchase' : 'sold';
    
    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Build search string based on direction and pattern
    // Purchase: tdlap=ge=DD/MM/YYYYT00:00:00;tdlap=le=DD/MM/YYYYT23:59:59;ttxly==5
    // Sold: tdlap=ge=DD/MM/YYYYT00:00:00;tdlap=le=DD/MM/YYYYT23:59:59
    let searchStr = `tdlap=ge=${formatDate(start)}T00:00:00;tdlap=le=${formatDate(end)}T23:59:59`;
    if (direction === 'IN') {
      searchStr += ';ttxly==5';
    }

    const size = query.size ?? 15;
    const url = `https://hoadondientu.gdt.gov.vn/api/query/invoices/${endpoint}?sort=tdlap:desc&size=${size}&search=${encodeURIComponent(searchStr)}`;

    let token = config.gdtJwt;
    if (token && !token.startsWith('Bearer ')) {
      token = `Bearer ${token}`;
    }

    const headers: Record<string, string> = {
      'Authorization': token,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'vi',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 OPR/130.0.0.0',
      'Content-Type': 'application/json',
      'Action': encodeURIComponent(direction === 'IN' ? 'Tìm kiếm (hóa đơn mua vào)' : 'Tìm kiếm (hóa đơn bán ra)'),
      'Referer': 'https://hoadondientu.gdt.gov.vn/tra-cuu/tra-cuu-hoa-don',
    };
    if (config.gdtCookie) {
      headers['Cookie'] = config.gdtCookie;
    }

    this.logger.log(`Fetching from GDT: ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const res = await fetch(url, { 
        method: 'GET', 
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        if (res.status === 401) {
           throw new Error('Token Tổng cục Thuế đã hết hạn hoặc không hợp lệ. Vui lòng cập nhật lại trên UI.');
        }
        throw new Error(`Lỗi HTTP ${res.status}: ${await res.text()}`);
      }

      const data: any = await res.json();
      if (!data || !Array.isArray(data.datas)) {
        this.logger.warn(`Unexpected GDT response: ${JSON.stringify(data).slice(0, 200)}`);
        return [];
      }

      return data.datas.map((item: any) => this.mapGdtInvoiceToErp(item, direction, config));
    } catch (err: any) {
      this.logger.error(`fetchFromGdtApi failed: ${err.message}`);
      throw new InternalServerErrorException(err.message ?? 'Lỗi khi gọi API Tổng cục Thuế');
    }
  }

  private mapGdtInvoiceToErp(raw: any, direction: InvoiceDirection, cfg: any) {
    const now = new Date().toISOString();
    
    // Parse tdlap (usually something like "2024-05-15T..." or timestamp)
    let invoiceDate = now;
    if (raw.tdlap) {
      try {
        const d = new Date(raw.tdlap);
        if (!isNaN(d.getTime())) invoiceDate = d.toISOString();
      } catch {}
    }

    // Usually GDT has nbmst (Người bán), nbten, nmmst (Người mua), nmten
    const sellerTaxCode = raw.nbmst ?? (direction === 'IN' ? null : cfg.taxCode);
    const sellerName = raw.nbten ?? (direction === 'IN' ? 'Người bán' : 'Công ty Liouni');
    const buyerTaxCode = raw.nmmst ?? (direction === 'OUT' ? null : cfg.taxCode);
    const buyerName = raw.nmten ?? (direction === 'OUT' ? 'Khách hàng' : 'Công ty Liouni');

    // Mẫu số, Ký hiệu, Số HĐ
    const khhdon = raw.khmshdon ?? raw.khhd ?? '';
    const khmshdon = raw.khhdon ?? raw.khms ?? '';
    const soHdon = raw.shdon ?? '';
    
    const invoiceNo = soHdon ? soHdon.toString().padStart(7, '0') : `GDT-${Date.now().toString().slice(-6)}`;
    const docNo = `${khmshdon}${khhdon}-${invoiceNo}`.replace(/^-/, '');

    const totalAmount = Number(raw.tgtcthue ?? raw.tgtttbso ?? 0);
    const vatAmount = Number(raw.tgtthue ?? 0);

    return {
      external_invoice_id: raw.id ?? `GDT-${raw.khmshdon}-${raw.shdon}-${direction}`,
      document_no: docNo || `GDT-${Date.now().toString().slice(-6)}`,
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
      source: 'TAX_PORTAL',
      direction,
      tax_status: raw.ttxly === 5 ? 'Đã cấp mã CQT' : (raw.ttxly === 6 ? 'Hóa đơn thay thế' : `Trạng thái: ${raw.ttxly}`),
      status: 'SYNCED',
      seller_name: sellerName,
      seller_tax_code: sellerTaxCode,
      seller_address: raw.nbdchi ?? '',
      buyer_name: buyerName,
      buyer_tax_code: buyerTaxCode,
      buyer_address: raw.nmdchi ?? '',
      total_amount: totalAmount,
      vat_amount: vatAmount,
      request_payload: {},
      response_payload: raw,
      synced_at: now,
    };
  }

  private normalizeDraftLine(line: DraftInvoiceLineInput, index: number) {
    const quantity = Number(line.quantity ?? 1);
    const unitPrice = Number(line.unitPrice ?? line.unit_price ?? 0);
    const taxRate = Number(line.taxRate ?? line.tax_rate ?? 0);
    const amountWithoutTax = quantity * unitPrice;
    const taxAmount = amountWithoutTax * (taxRate / 100);
    return {
      lineNumber: index + 1,
      itemName: line.description ?? line.itemName ?? `Dòng hàng ${index + 1}`,
      quantity,
      unitPrice,
      taxRate,
      amountWithoutTax,
      taxAmount,
    };
  }

  private buildDraftInvoicePayload(input?: DraftInvoiceInput) {
    const config = input ?? {};
    const lines = (config.lines?.length
      ? config.lines
      : [{ description: config.description ?? 'Hóa đơn nháp ERP', quantity: 1, unitPrice: 0, taxRate: 10 }]
    ).map((line, index) => this.normalizeDraftLine(line, index));
    const totalWithoutTax = lines.reduce((sum, line) => sum + line.amountWithoutTax, 0);
    const totalTaxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
    const totalAmountWithTax = totalWithoutTax + totalTaxAmount;

    return {
      documentNo: config.documentNo ?? config.document_no ?? `DRAFT-${Date.now()}`,
      buyerName: config.buyerName ?? config.buyer_name ?? 'Khách hàng nháp ERP',
      buyerTaxCode: config.buyerTaxCode ?? config.buyer_tax_code ?? null,
      buyerAddress: config.buyerAddress ?? config.buyer_address ?? null,
      buyerEmail: config.buyerEmail ?? config.buyer_email ?? null,
      currencyCode: config.currencyCode ?? config.currency_code ?? 'VND',
      description: config.description ?? 'Chỉ lưu nháp, không phát hành',
      lines,
      totals: {
        totalWithoutTax,
        totalTaxAmount,
        totalAmountWithTax,
      },
    };
  }

  async createInvoice(invoiceData?: any) {
    const config = await this.getConfig();
    const draft = this.buildDraftInvoicePayload(invoiceData);
    const requestPayload = {
      mode: 'DRAFT_ONLY',
      supplierTaxCode: config.supplierTaxCode,
      draft,
      warning:
        'Không gọi Viettel phát hành. Bản ghi này chỉ được lưu nội bộ để user kiểm tra trước khi có flow phát hành riêng.',
    };
    const responsePayload = {
      ok: true,
      mode: 'DRAFT_ONLY',
      status: 'DRAFT',
      provider: 'SINVOICE',
      draftId: draft.documentNo,
      message:
        'Đã lưu hóa đơn nháp nội bộ. Tính năng ký/phát hành đang bị ẩn để tránh phát hành nhầm.',
    };
    await this.persistEinvoice(requestPayload, responsePayload, 'DRAFT');
    return { ok: true, request: requestPayload, response: responsePayload };
  }

  async cancelInvoice() {
    throw new BadRequestException(
      'Tính năng hủy/phát hành hóa đơn đang tạm khóa trong draft-only mode.',
    );
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
    throw new BadRequestException(
      'Demo flow đã bị tắt. Hệ thống hiện chỉ cho phép lưu hóa đơn nháp nội bộ để tránh phát hành nhầm.',
    );
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
    const draft = requestPayload?.draft ?? null;
    const data = {
      source: 'SINVOICE' as InvoiceSource,
      direction: 'OUT' as InvoiceDirection,
      supplier_tax_code: config.supplierTaxCode,
      document_no: draft?.documentNo ?? requestPayload?.generalInvoiceInfo?.invoiceNo ?? `DEMO-${Date.now()}`,
      invoice_no: status === 'DRAFT' ? null : responsePayload?.result?.invoiceNo ?? responsePayload?.invoiceNo ?? null,
      pattern: requestPayload?.generalInvoiceInfo?.templateCode ?? null,
      invoice_series: requestPayload?.generalInvoiceInfo?.invoiceSeries ?? null,
      buyer_name: draft?.buyerName ?? requestPayload?.buyerInfo?.buyerName ?? requestPayload?.buyerInfo?.buyerLegalName ?? null,
      buyer_tax_code: draft?.buyerTaxCode ?? requestPayload?.buyerInfo?.buyerTaxCode ?? null,
      buyer_address: draft?.buyerAddress ?? requestPayload?.buyerInfo?.buyerAddressLine ?? null,
      seller_name: 'Công ty Liouni',
      seller_tax_code: config.supplierTaxCode,
      total_amount: Number(draft?.totals?.totalAmountWithTax ?? requestPayload?.summarizeInfo?.totalAmountWithTax ?? 0),
      vat_amount: Number(draft?.totals?.totalTaxAmount ?? requestPayload?.summarizeInfo?.totalTaxAmount ?? 0),
      status,
      tax_status: status === 'DRAFT' ? 'LOCAL_DRAFT_ONLY' : responsePayload?.result?.status ?? null,
      viettel_transaction_id: status === 'DRAFT' ? null : responsePayload?.result?.transactionUuid ?? responsePayload?.transactionUuid ?? null,
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
