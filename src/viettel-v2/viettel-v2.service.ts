import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateViettelV2DraftDto, SyncViettelV2InboundDto } from './dto/viettel-v2.dto';

interface NormalizedSinvoiceConfig {
  supplierTaxCode: string;
  username: string;
  password: string;
  apiUrl: string;
  environment: string;
  accessToken?: string;
}

type InvoiceDirection = 'IN' | 'OUT';

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

  async getConfig(): Promise<NormalizedSinvoiceConfig> {
    const result = await this.directusRequest<{ data: any[] }>('/items/sinvoice_configs?filter[is_active][_eq]=true');
    const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!row) throw new BadRequestException('Chưa cấu hình SInvoice trong hệ thống');
    return {
      supplierTaxCode: row.supplier_tax_code,
      username: row.username,
      password: row.password,
      apiUrl: row.api_url,
      environment: row.environment,
    };
  }

  private async callViettel(path: string, payload: any, config: NormalizedSinvoiceConfig, method: 'GET' | 'POST' = 'POST') {
    if (!config.apiUrl || !config.username || !config.password) {
      throw new BadRequestException('Thiếu cấu hình Viettel v2 để gọi API');
    }

    let baseUrl = config.apiUrl.endsWith('/') ? config.apiUrl.slice(0, -1) : config.apiUrl;
    
    // Viettel v2 logic: business APIs (InvoiceWS/InvoiceUtilsWS) đi qua InvoiceAPI; chỉ auth/login đi thẳng base
    if (path !== '/auth/login' && !baseUrl.includes('services/einvoiceapplication/api/InvoiceAPI')) {
        baseUrl = `${baseUrl}/services/einvoiceapplication/api/InvoiceAPI`;
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${baseUrl}${cleanPath}`;

    let res: Response;
    try {
      res = await fetch(fullUrl, {
        method: method,
        headers: {
          Authorization: config.accessToken ? `Bearer ${config.accessToken}` : `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
      });
    } catch (err) {
      this.logger.warn(`Viettel fetch failed once, retrying: ${fullUrl}`);
      res = await fetch(fullUrl, {
        method: method,
        headers: {
          Authorization: config.accessToken ? `Bearer ${config.accessToken}` : `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: method === 'POST' ? JSON.stringify(payload) : undefined,
      });
    }

    const text = await res.text();
    let data: any = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
      const detailMessage = String(data?.message || data?.errorCode || '');
      if (res.status === 400 && path.includes('/InvoiceUtilsWS/getInvoicesAll/') && detailMessage.includes('NOT_FOUND_DATA')) {
        return { invoices: [] };
      }
      throw new BadRequestException({
        message: `Viettel v2 request failed (${res.status})`,
        detail: data,
      });
    }

    return data;
  }

  private async loginViettel(config: NormalizedSinvoiceConfig) {
    const payload = {
        username: config.username,
        password: config.password
    };
    const response = await this.callViettel('/auth/login', payload, config);
    if (!response?.access_token) {
        throw new BadRequestException('Không thể đăng nhập Viettel S-Invoice');
    }
    return response.access_token;
  }

  async health() {
    const config = await this.getConfig();
    const token = await this.loginViettel(config);
    return { ok: !!token, provider: 'VIETTEL_V2' };
  }

  async createDraft(body: CreateViettelV2DraftDto) {
    const config = await this.getConfig();
    const token = await this.loginViettel(config);
    config.accessToken = token;

    const normalizedBuyerTaxCode = String(body.buyerTaxCode ?? '').trim();
    const normalizedBuyerAddress = String(body.buyerAddress ?? '').trim();
    if (normalizedBuyerTaxCode && !normalizedBuyerAddress) {
      throw new BadRequestException('buyerAddress là bắt buộc khi có buyerTaxCode (quy định Viettel).');
    }

    const lines = (body.lines ?? []).map((line, idx) => {
        const quantity = Number(line.quantity ?? 1);
        const unitPrice = Number(line.unitPrice ?? 0);
        const taxRate = Number(line.taxRate ?? 10);
        const lineAmount = quantity * unitPrice;
        const taxAmount = (lineAmount * taxRate) / 100;
        return {
            lineNumber: idx + 1,
            selection: "1",
            itemName: line.itemName || line.description || "Hàng hóa",
            unitName: line.unitName || "Cái",
            quantity,
            unitPrice,
            taxRate,
            taxPercentage: taxRate,
            taxAmount,
            itemTotalAmountWithoutTax: lineAmount
        };
    });

    const sumOfTotalLineAmountWithoutTax = lines.reduce((sum, l) => sum + l.itemTotalAmountWithoutTax, 0);
    const totalTaxAmount = lines.reduce((sum, l) => sum + l.taxAmount, 0);

    const viettelPayload = {
        generalInvoiceInfo: {
            invoiceType: "1",
            templateCode: body.templateCode || "1/001",
            invoiceSeries: body.invoiceSeries || "C26TGA",
            currencyCode: body.currencyCode || "VND",
            adjustmentType: "1",
            paymentStatus: true,
            paymentMethod: body.paymentMethod || "6"
        },
        sellerInfo: {
            sellerTaxCode: config.supplierTaxCode,
            sellerLegalName: "Công ty Liouni",
            sellerAddressLine: body.sellerAddress || "123 Đường Liouni, HCM"
        },
        buyerInfo: {
            buyerName: body.buyerName || "Khách lẻ",
            buyerTaxCode: normalizedBuyerTaxCode,
            buyerAddressLine: normalizedBuyerAddress,
            buyerEmail: body.buyerEmail || "",
            buyerNotGetInvoice: 0
        },
        itemInfo: lines,
        taxBreakdowns: Array.from(new Set(lines.map(l => l.taxRate))).map(rate => {
            const items = lines.filter(l => l.taxRate === rate);
            return {
                taxRate: rate,
                taxableAmount: items.reduce((sum, l) => sum + l.itemTotalAmountWithoutTax, 0),
                taxAmount: items.reduce((sum, l) => sum + l.taxAmount, 0)
            };
        }),
        summarizeInfo: {
            sumOfTotalLineAmountWithoutTax,
            totalAmountWithoutTax: sumOfTotalLineAmountWithoutTax,
            totalTaxAmount,
            totalAmountWithTax: sumOfTotalLineAmountWithoutTax + totalTaxAmount,
            totalAmountWithTaxInWords: "" 
        },
        payments: [{
            paymentMethod: body.paymentMethod || "6",
            paymentMethodName: body.paymentMethod === "6" ? "Tiền mặt" : "Chuyển khoản"
        }]
    };

    const result = await this.callViettel(
      `/InvoiceWS/createOrUpdateInvoiceDraft/${config.supplierTaxCode}`,
      viettelPayload,
      config
    );

    return { ok: true, result };
  }

  async syncInbound(body: SyncViettelV2InboundDto, direction: InvoiceDirection = 'IN') {
    const config = await this.getConfig();
    const token = await this.loginViettel(config);
    config.accessToken = token;

    const supplierTaxCode = config.supplierTaxCode;
    const startDate = new Date(body.issueStartDate);
    const endDate = new Date(body.issueEndDate);
    const chunks = [{ start: startDate, end: endDate }];

    const allInvoices: any[] = [];
    for (const chunk of chunks) {
      const toYmd = (d: Date) => d.toISOString().slice(0, 10);
      const requestPayload = {
        startDate: toYmd(chunk.start),
        endDate: toYmd(chunk.end),
        rowPerPage: Number(body.rowPerPage ?? 20),
        pageNum: Number(body.pageNum ?? 1),
        templateCode: null,
      };

      let responsePayload: any;
      try {
        responsePayload = await this.callViettel(
          `/InvoiceUtilsWS/getInvoicesAll/${supplierTaxCode}`,
          requestPayload,
          config,
        );
      } catch (error: any) {
        const detailMessage = String(error?.response?.message || error?.message || '');
        if (detailMessage.includes('NOT_FOUND_DATA')) {
          this.logger.log(`Viettel getInvoicesAll page ${requestPayload.pageNum}: NOT_FOUND_DATA -> treat as empty result`);
          return {
            ok: true,
            count: 0,
            surface: 'SINVOICE',
            status: 'ISSUED',
            pageNum: requestPayload.pageNum,
            rowPerPage: requestPayload.rowPerPage,
          };
        }
        throw error;
      }

      const items = responsePayload?.invoices ?? [];
      for (const raw of items) {
        const mapped = {
          external_invoice_id: String(raw.invoiceId ?? raw.id ?? ''),
          invoice_no: raw.invoiceNo || raw.invoiceSeri || null,
          supplier_tax_code: raw.sellerTaxCode || raw.tenantTaxCode || supplierTaxCode,
          buyer_name: raw.buyerName || raw.buyerUnitName || null,
          buyer_tax_code: raw.buyerTaxCode || null,
          total_amount: Number(raw.totalAmountWithVAT ?? raw.totalPaymentAmount ?? raw.total ?? 0),
          vat_amount: Number(raw.totalVATAmount ?? raw.totalTaxAmount ?? raw.taxAmount ?? 0),
          invoice_date: raw.signedDate || raw.issueDate || raw.issueDateStr || raw.createdDate || null,
          status: 'ISSUED',
          source: 'SINVOICE',
          direction,
          response_payload: raw,
        };
        await this.upsertExternalEinvoice(mapped, mapped.supplier_tax_code);
        allInvoices.push(mapped);
      }
    }

    return { ok: true, count: allInvoices.length };
  }

  private async upsertExternalEinvoice(data: any, supplierTaxCode: string) {
    const externalId = data.external_invoice_id;
    const invoiceNo = data.invoice_no;
    const status = data.status;
    const source = data.source;
    const direction = data.direction;

    const scopedClauses: any[] = [];
    if (source) scopedClauses.push({ source: { _eq: source } });
    if (direction) scopedClauses.push({ direction: { _eq: direction } });
    if (status) scopedClauses.push({ status: { _eq: status } });

    if (externalId) {
      const filterPayload =
        scopedClauses.length > 0
          ? { _and: [{ external_invoice_id: { _eq: externalId } }, ...scopedClauses] }
          : { external_invoice_id: { _eq: externalId } };
      const filterByExternal = encodeURIComponent(JSON.stringify(filterPayload));
      const byExternal = await this.directusRequest<{ data: any[] | any }>(`/items/einvoices?limit=1&filter=${filterByExternal}`);
      let extRow = Array.isArray(byExternal?.data) ? byExternal.data[0] : byExternal?.data;

      if (!extRow?.id) {
        const fallbackFilter = encodeURIComponent(JSON.stringify({ external_invoice_id: { _eq: externalId } }));
        const fallback = await this.directusRequest<{ data: any[] | any }>(`/items/einvoices?limit=1&filter=${fallbackFilter}`);
        extRow = Array.isArray(fallback?.data) ? fallback.data[0] : fallback?.data;
      }

      if (extRow?.id) {
        return this.directusRequest(`/items/einvoices/${extRow.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }
    }

    if (invoiceNo) {
      const filterByInvoiceNo = encodeURIComponent(
        JSON.stringify({
          _and: [
            { supplier_tax_code: { _eq: supplierTaxCode } },
            { invoice_no: { _eq: invoiceNo } },
            ...scopedClauses,
          ],
        }),
      );
      const byInvoiceNo = await this.directusRequest<{ data: any[] | any }>(`/items/einvoices?limit=1&filter=${filterByInvoiceNo}`);
      const invRow = Array.isArray(byInvoiceNo?.data) ? byInvoiceNo.data[0] : byInvoiceNo?.data;
      if (invRow?.id) {
        return this.directusRequest(`/items/einvoices/${invRow.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }
    }

    try {
      return await this.directusRequest('/items/einvoices', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (invoiceNo) {
        const fallbackByInvoiceNo = encodeURIComponent(
          JSON.stringify({
            _and: [
              { supplier_tax_code: { _eq: supplierTaxCode } },
              { invoice_no: { _eq: invoiceNo } },
            ],
          }),
        );
        const fallback = await this.directusRequest<{ data: any[] | any }>(`/items/einvoices?limit=1&filter=${fallbackByInvoiceNo}`);
        const fallbackRow = Array.isArray(fallback?.data) ? fallback.data[0] : fallback?.data;
        if (fallbackRow?.id) {
          return this.directusRequest(`/items/einvoices/${fallbackRow.id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
          });
        }
      }
      throw error;
    }
  }

  async getTemplates() {
    const config = await this.getConfig();
    const token = await this.loginViettel(config);
    config.accessToken = token;

    return this.callViettel('/InvoiceUtilsWS/getAllInvoiceTemplates', {
        taxCode: config.supplierTaxCode,
        invoiceType: 'all'
    }, config);
  }

  async syncDraft(query: any) {
    const config = await this.getConfig();
    const token = await this.loginViettel(config);
    const startDate = query?.startDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const endDate = query?.endDate ?? new Date().toISOString().slice(0, 10);
    const pageSize = Number(query?.size ?? 50);
    let page = 0;
    let totalPages = 1;
    let count = 0;
    const invoiceNos: string[] = [];

    while (page < totalPages) {
      const url = `/cluster3/services/einvoiceapplication/api/invoice/search-draft-all?page=${page}&size=${pageSize}&createdDate.greaterThanOrEqual=${encodeURIComponent(startDate + 'T00:00:00.000Z')}&createdDate.lessThanOrEqual=${encodeURIComponent(endDate + 'T23:59:59.000Z')}&invoiceStatus.equals=0&invoiceTypeId.notEquals=52&sort=id,desc`;
      const res = await fetch(`https://vinvoice.viettel.vn/api${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new BadRequestException(`Draft sync failed (${res.status})`);
      const json = await res.json();
      const data = json?.data;
      const items = data?.content ?? [];
      totalPages = Number(data?.totalPages ?? 1);
      for (const raw of items) {
        const mapped = {
          external_invoice_id: String(raw.id),
          invoice_no: raw.invoiceNo || raw.invoiceSeri || null,
          supplier_tax_code: raw.tenantTaxCode || config.supplierTaxCode,
          buyer_name: raw.buyerName || raw.buyerUnitName || null,
          buyer_tax_code: raw.buyerTaxCode || null,
          total_amount: Number(raw.totalAmountWithVAT ?? 0),
          vat_amount: Number(raw.totalVATAmount ?? 0),
          invoice_date: raw.createdDate || raw.issueDate || null,
          status: 'DRAFT',
          source: 'SINVOICE',
          direction: 'OUT',
          response_payload: raw,
        };
        await this.upsertExternalEinvoice(mapped, mapped.supplier_tax_code);
        count += 1;
        if (mapped.invoice_no) invoiceNos.push(mapped.invoice_no);
      }
      page += 1;
    }

    return { ok: true, surface: 'SINVOICE', status: 'DRAFT', count, invoice_nos: [...new Set(invoiceNos)] };
  }

  async syncIssued(query: any) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dto = {
      issueStartDate: query?.startDate ?? query?.issueStartDate ?? firstDayOfMonth.toISOString(),
      issueEndDate: query?.endDate ?? query?.issueEndDate ?? now.toISOString(),
      pageNum: query?.pageNum,
      rowPerPage: query?.rowPerPage,
    };
    const result = await this.syncInbound(dto, 'OUT');
    return { ...result, surface: 'SINVOICE', status: 'ISSUED' };
  }

  async listLocal(query: any) {
    const page = Math.max(1, Number(query?.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Number(query?.pageSize ?? 15)));
    const filter: any = {};
    if (query?.source) filter.source = { _eq: query.source };
    if (query?.direction) filter.direction = { _eq: query.direction };
    if (query?.status) filter.status = { _eq: query.status };
    if (query?.search) {
      filter._or = [
        { invoice_no: { _icontains: query.search } },
        { buyer_name: { _icontains: query.search } },
        { external_invoice_id: { _icontains: query.search } },
      ];
    }
    if (query?.startDate || query?.endDate) {
      filter.invoice_date = {};
      if (query?.startDate) filter.invoice_date._gte = `${query.startDate}T00:00:00.000Z`;
      if (query?.endDate) filter.invoice_date._lte = `${query.endDate}T23:59:59.999Z`;
    }
    const encodedFilter = encodeURIComponent(JSON.stringify(filter));
    const offset = (page - 1) * pageSize;
    const result = await this.directusRequest<{ data: any[]; meta?: any }>(`/items/einvoices?limit=${pageSize}&offset=${offset}&sort=-invoice_date&filter=${encodedFilter}&meta=filter_count`);
    const total = Number(result?.meta?.filter_count ?? 0);
    return {
      data: result?.data ?? [],
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}

