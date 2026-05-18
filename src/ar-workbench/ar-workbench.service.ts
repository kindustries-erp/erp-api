import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArWorkbenchQueryDto } from './dto/ar-workbench-query.dto';
import { CreateArDocumentDto } from './dto/create-ar-document.dto';
import { UpdateArDocumentDto } from './dto/update-ar-document.dto';
import { CreateArApplicationDto } from './dto/create-ar-application.dto';
import { CreateArCollectionActivityDto } from './dto/create-ar-collection-activity.dto';
import {
  CreateArSalesInvoiceDto,
  CreateArSalesInvoiceLineDto,
} from './dto/create-ar-sales-invoice.dto';
import { ReverseArDocumentDto } from './dto/reverse-ar-document.dto';
import { CreatePaymentReceiptDto } from './dto/create-payment-receipt.dto';
import { CreateCustomerAdvanceDto } from './dto/create-customer-advance.dto';
import { ApplyAdvanceToInvoiceDto } from './dto/apply-advance-to-invoice.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
} from '../common/utils/directus-error.util';

type DirectusList<T> = { data?: T[]; meta?: { filter_count?: number } };

type ArDocument = {
  id: string;
  document_no: string;
  document_type: string;
  business_partner_id?: string | null;
  accounting_account_id?: string | null;
  document_date: string;
  posting_date: string;
  due_date?: string | null;
  total_amount: number | string;
  settled_amount: number | string;
  open_amount: number | string;
  status: string;
  risk_status?: string;
  collection_status?: string;
  metadata?: Record<string, unknown> | null;
  business_partner_name_snapshot?: string | null;
  can_delete?: boolean;
  related_documents?: any[];
};

type ArDocumentLine = {
  id: string;
  ar_document_id: string;
  line_no: number;
  item_code?: string | null;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  tax_rate: number | string;
  tax_amount: number | string;
  line_amount: number | string;
  revenue_account_id?: string | null;
  tax_account_id?: string | null;
};

type JournalEntry = {
  id: number;
  voucher_no?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  total_debit: number | string;
  total_credit: number | string;
  status: string;
};

type JournalEntryLine = {
  id: number;
  journal_entry_id: number;
  account_id: string;
  debit: number | string;
  credit: number | string;
  description?: string | null;
  sort?: number | null;
};

const AR_COVERAGE = [
  {
    id: 1,
    use_case: 'Bán hàng công nợ',
    status: 'phase1_supported',
    route: 'ar_documents:INVOICE',
  },
  {
    id: 2,
    use_case: 'Bán hàng thu tiền ngay',
    status: 'phase1_supported',
    route: 'ar_documents:IMMEDIATE_SALE + ar_applications:PAYMENT',
  },
  {
    id: 3,
    use_case: 'Khách đặt cọc trước',
    status: 'phase1_supported',
    route: 'ar_documents:ADVANCE',
  },
  {
    id: 4,
    use_case: 'Cấn trừ tiền cọc',
    status: 'phase1_supported',
    route: 'ar_applications:ADVANCE_APPLIED',
  },
  {
    id: 5,
    use_case: 'Một payment trả nhiều invoice',
    status: 'phase1_supported',
    route: 'multiple ar_applications per payment_voucher_id',
  },
  {
    id: 6,
    use_case: 'Một invoice nhận nhiều payment',
    status: 'phase1_supported',
    route: 'multiple ar_applications per target_document_id',
  },
  {
    id: 7,
    use_case: 'Thanh toán dư',
    status: 'phase1_supported',
    route: 'ar_documents:ADVANCE/SUSPENSE for unapplied cash',
  },
  {
    id: 8,
    use_case: 'Thanh toán thiếu',
    status: 'phase1_supported',
    route: 'partial status + WRITE_OFF application',
  },
  {
    id: 9,
    use_case: 'Chưa xác định khách chuyển tiền',
    status: 'phase1_supported',
    route: 'ar_documents:SUSPENSE',
  },
  {
    id: 10,
    use_case: 'Xác định lại khoản treo',
    status: 'phase1_supported',
    route: 'ar_applications:SUSPENSE_CLEARING',
  },
  {
    id: 11,
    use_case: 'Giảm giá sau bán',
    status: 'phase1_supported',
    route: 'ar_documents:CREDIT_NOTE',
  },
  {
    id: 12,
    use_case: 'Hàng bán bị trả lại',
    status: 'phase1_supported',
    route: 'ar_documents:SALES_RETURN',
  },
  {
    id: 13,
    use_case: 'Invoice disputed',
    status: 'phase1_supported',
    route: 'dispute_status/status + collection activity DISPUTE',
  },
  {
    id: 14,
    use_case: 'Nợ quá hạn',
    status: 'phase1_supported',
    route: 'due_date + overdue filters/summary',
  },
  {
    id: 15,
    use_case: 'Trích lập dự phòng nợ xấu',
    status: 'phase1_foundation',
    route: 'risk_status BAD_DEBT_RISK + collection BAD_DEBT_REVIEW',
  },
  {
    id: 16,
    use_case: 'Xóa nợ xấu',
    status: 'phase1_foundation',
    route: 'ar_documents/application WRITE_OFF',
  },
  {
    id: 17,
    use_case: 'Refund khách hàng',
    status: 'phase1_supported',
    route: 'ar_documents:REFUND + ar_applications:REFUND',
  },
  {
    id: 18,
    use_case: 'Bù trừ công nợ',
    status: 'phase1_supported',
    route: 'ar_applications:CUSTOMER_VENDOR_OFFSET',
  },
  {
    id: 19,
    use_case: 'Thu hộ / đại lý',
    status: 'phase1_foundation',
    route: 'ar_documents:SUSPENSE/ADJUSTMENT metadata',
  },
  {
    id: 20,
    use_case: 'COD',
    status: 'phase1_supported',
    route: 'ar_documents:COD',
  },
  {
    id: 21,
    use_case: 'COD chuyển tiền về',
    status: 'phase1_supported',
    route: 'ar_applications:COD_SETTLEMENT',
  },
  {
    id: 22,
    use_case: 'Payment gateway',
    status: 'phase1_supported',
    route: 'ar_documents:GATEWAY + GATEWAY_SETTLEMENT metadata fee',
  },
  {
    id: 23,
    use_case: 'Thu ngoại tệ',
    status: 'phase1_foundation',
    route: 'currency/exchange_rate + FX_REALIZED',
  },
  {
    id: 24,
    use_case: 'Đánh giá lại tỷ giá cuối kỳ',
    status: 'phase1_foundation',
    route: 'ar_documents:FX_REVALUATION',
  },
  {
    id: 25,
    use_case: 'Công nợ theo hợp đồng',
    status: 'phase1_supported',
    route: 'ar_documents:CONTRACT_MILESTONE',
  },
  {
    id: 26,
    use_case: 'Retention receivable',
    status: 'phase1_supported',
    route: 'ar_documents:RETENTION',
  },
  {
    id: 27,
    use_case: 'Intercompany receivable',
    status: 'phase1_supported',
    route: 'ar_documents:INTERCOMPANY',
  },
  {
    id: 28,
    use_case: 'Write-off nhỏ',
    status: 'phase1_supported',
    route: 'ar_applications:WRITE_OFF',
  },
  {
    id: 29,
    use_case: 'Thu sai công ty',
    status: 'phase1_foundation',
    route: 'SUSPENSE + metadata company evidence',
  },
  {
    id: 30,
    use_case: 'Reverse invoice',
    status: 'phase1_foundation',
    route: 'status REVERSED + reversal references in metadata',
  },
  {
    id: 31,
    use_case: 'Reverse payment',
    status: 'phase1_foundation',
    route: 'application status REVERSED + reverse voucher link',
  },
  {
    id: 32,
    use_case: 'Collection workflow',
    status: 'phase1_supported',
    route: 'ar_collection_activities',
  },
  {
    id: 33,
    use_case: 'Promise to pay',
    status: 'phase1_supported',
    route: 'promise_to_pay_date + activity PROMISE_TO_PAY',
  },
  {
    id: 34,
    use_case: 'Bad debt legal case',
    status: 'phase1_supported',
    route: 'activity LEGAL_CASE + risk LEGAL',
  },
  {
    id: 35,
    use_case: 'Advance chưa dùng hết',
    status: 'phase1_supported',
    route: 'ADVANCE open_amount',
  },
  {
    id: 36,
    use_case: 'Khách trả nhầm invoice',
    status: 'phase1_supported',
    route: 'ar_applications:REALLOCATION',
  },
  {
    id: 37,
    use_case: 'Thu tiền mặt',
    status: 'existing_supported',
    route: 'payment_vouchers CASH_RECEIPT + AR application',
  },
  {
    id: 38,
    use_case: 'Thu qua ngân hàng',
    status: 'existing_supported',
    route: 'payment_vouchers BANK_RECEIPT + AR application',
  },
  {
    id: 39,
    use_case: 'Thu qua ví điện tử',
    status: 'phase1_foundation',
    route: 'GATEWAY metadata pending settlement',
  },
  {
    id: 40,
    use_case: 'Chưa reconcile bank',
    status: 'phase1_foundation',
    route: 'metadata reconciliation status + payment voucher link',
  },
];

@Injectable()
export class ArWorkbenchService {
  private readonly logger = new Logger(ArWorkbenchService.name);

  constructor(private readonly configService: ConfigService) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private async request<T>(
    path: string,
    userToken: string,
    init: RequestInit = {},
  ): Promise<T> {
    this.guard(userToken);
    const response = await fetch(new URL(path, this.directusUrl), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      await throwDirectusResponseError(
        response,
        'Không thể xử lý AR Workbench',
      );
    }
    return (await response.json()) as T;
  }

  /**
   * Write operations (POST/PATCH/DELETE) cần quyền admin vì user role
   * không có write permission trên collections AR.
   */
  private async requestWrite<T>(
    path: string,
    userToken: string,
    init: RequestInit = {},
  ): Promise<T> {
    this.guard(userToken);
    const response = await fetch(new URL(path, this.directusUrl), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.adminToken}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      await throwDirectusResponseError(
        response,
        'Không thể xử lý AR Workbench',
      );
    }
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  }

  private pagination(query: ArWorkbenchQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return {
      page,
      pageSize,
      offset: (page - 1) * pageSize,
      sort: query.sort || '-created_at',
    };
  }

  private appendDocumentFilter(url: URL, query: ArWorkbenchQueryDto) {
    const filterAnd: any[] = [];
    if (query.business_partner_id)
      filterAnd.push({
        business_partner_id: { _eq: query.business_partner_id },
      });
    if (query.document_type)
      filterAnd.push({ document_type: { _eq: query.document_type } });
    if (query.status) filterAnd.push({ status: { _eq: query.status } });
    if (query.risk_status)
      filterAnd.push({ risk_status: { _eq: query.risk_status } });
    if (query.open_only)
      filterAnd.push(
        { status: { _in: ['POSTED', 'PARTIAL'] } },
        { open_amount: { _gt: 0 } },
      );
    if (query.overdue) {
      filterAnd.push({
        due_date: { _lt: new Date().toISOString().slice(0, 10) },
      });
      filterAnd.push(
        { status: { _in: ['POSTED', 'PARTIAL'] } },
        { open_amount: { _gt: 0 } },
      );
    }
    if (filterAnd.length > 0)
      url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
  }

  private async decorateDocuments(docs: ArDocument[], userToken: string) {
    if (docs.length === 0) return docs;
    const docIds = docs.map((doc) => doc.id);
    const partnerIds = [
      ...new Set(
        docs.map((doc) => doc.business_partner_id).filter(Boolean) as string[],
      ),
    ];
    const linkedIds = new Set<string>();

    const relatedUrl = new URL(
      '/items/cash_bank_related_documents',
      this.directusUrl,
    );
    relatedUrl.searchParams.append('limit', '-1');
    relatedUrl.searchParams.append('fields[]', 'id');
    relatedUrl.searchParams.append('fields[]', 'payment_voucher_id');
    relatedUrl.searchParams.append('fields[]', 'payment_voucher_id.voucher_no');
    relatedUrl.searchParams.append(
      'fields[]',
      'payment_voucher_id.voucher_channel',
    );
    relatedUrl.searchParams.append(
      'fields[]',
      'payment_voucher_id.voucher_direction',
    );
    relatedUrl.searchParams.append('fields[]', 'payment_voucher_id.status');
    relatedUrl.searchParams.append(
      'fields[]',
      'payment_voucher_id.document_date',
    );
    relatedUrl.searchParams.append('fields[]', 'payment_voucher_id.amount');
    relatedUrl.searchParams.append('fields[]', 'related_id');
    relatedUrl.searchParams.append('fields[]', 'related_no');
    relatedUrl.searchParams.append('fields[]', 'related_date');
    relatedUrl.searchParams.append('fields[]', 'amount');
    relatedUrl.searchParams.append('fields[]', 'note');
    relatedUrl.searchParams.append(
      'filter',
      JSON.stringify({
        related_type: { _eq: 'ar_documents' },
        related_id: { _in: docIds },
      }),
    );
    const related = await this.request<
      DirectusList<{
        id?: string;
        payment_voucher_id?: string | null;
        related_id?: string | null;
        related_no?: string | null;
        related_date?: string | null;
        amount?: number | string | null;
        note?: string | null;
      }>
    >(relatedUrl.pathname + relatedUrl.search, userToken);
    const relatedByDoc = new Map<string, any[]>();
    for (const item of related.data || []) {
      if (!item.related_id) continue;
      linkedIds.add(item.related_id);
      const list = relatedByDoc.get(item.related_id) || [];
      list.push(item);
      relatedByDoc.set(item.related_id, list);
    }

    const appUrl = new URL('/items/ar_applications', this.directusUrl);
    appUrl.searchParams.append('limit', '-1');
    appUrl.searchParams.append('fields[]', 'source_document_id');
    appUrl.searchParams.append('fields[]', 'target_document_id');
    appUrl.searchParams.append(
      'filter',
      JSON.stringify({
        _or: [
          { source_document_id: { _in: docIds } },
          { target_document_id: { _in: docIds } },
        ],
      }),
    );
    const apps = await this.request<
      DirectusList<{
        source_document_id?: string | null;
        target_document_id?: string | null;
      }>
    >(appUrl.pathname + appUrl.search, userToken);
    for (const item of apps.data || []) {
      if (item.source_document_id) linkedIds.add(item.source_document_id);
      if (item.target_document_id) linkedIds.add(item.target_document_id);
    }

    const partnerNames = new Map<string, string>();
    if (partnerIds.length > 0) {
      const partnerUrl = new URL('/items/business_partners', this.directusUrl);
      partnerUrl.searchParams.append('limit', '-1');
      partnerUrl.searchParams.append('fields[]', 'id');
      partnerUrl.searchParams.append('fields[]', 'display_name');
      partnerUrl.searchParams.append(
        'filter',
        JSON.stringify({ id: { _in: partnerIds } }),
      );
      const partners = await this.request<
        DirectusList<{ id: string; display_name?: string | null }>
      >(partnerUrl.pathname + partnerUrl.search, userToken);
      for (const partner of partners.data || [])
        partnerNames.set(partner.id, partner.display_name || partner.id);
    }

    return docs.map((doc) => ({
      ...doc,
      business_partner_name_snapshot: doc.business_partner_id
        ? partnerNames.get(doc.business_partner_id) || null
        : null,
      can_delete: !linkedIds.has(doc.id),
      related_documents: relatedByDoc.get(doc.id) || [],
    }));
  }

  private async ensureDocumentCanDelete(id: string, userToken: string) {
    const docUrl = new URL(`/items/ar_documents/${id}`, this.directusUrl);
    docUrl.searchParams.append('fields[]', 'id');
    const doc = await this.request<{ data?: { id: string } }>(
      docUrl.pathname + docUrl.search,
      userToken,
    );
    if (!doc.data?.id)
      throw new NotFoundException('Không tìm thấy AR document');

    const decorated = await this.decorateDocuments(
      [{ id } as ArDocument],
      userToken,
    );
    if (decorated[0]?.can_delete === false) {
      throw new BadRequestException(
        'Không thể xóa chứng từ đã có liên kết thanh toán/cấn trừ',
      );
    }
  }

  async findDocuments(query: ArWorkbenchQueryDto, userToken: string) {
    try {
      const { page, pageSize, offset, sort } = this.pagination(query);
      const url = new URL('/items/ar_documents', this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);
      this.appendDocumentFilter(url, query);
      const result = await this.request<DirectusList<ArDocument>>(
        url.pathname + url.search,
        userToken,
      );
      const total = result.meta?.filter_count || 0;
      return {
        items: await this.decorateDocuments(result.data || [], userToken),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách AR documents', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách AR documents',
      );
    }
  }

  async createDocument(dto: CreateArDocumentDto, userToken: string) {
    if (dto.status && ['REVERSED', 'CANCELLED'].includes(dto.status)) {
      throw new BadRequestException(
        'Không tạo mới trực tiếp chứng từ trạng thái reversed/cancelled',
      );
    }
    const result = await this.requestWrite<{ data: ArDocument }>(
      '/items/ar_documents',
      userToken,
      {
        method: 'POST',
        body: JSON.stringify({ ...dto, status: dto.status || 'DRAFT' }),
      },
    );
    return { message: 'Tạo AR document thành công', data: result.data };
  }

  private async getAccountIdByCode(accountCode: string, userToken: string) {
    const url = new URL('/items/chart_of_accounts', this.directusUrl);
    url.searchParams.append('limit', '1');
    url.searchParams.append('fields[]', 'id');
    url.searchParams.append(
      'filter',
      JSON.stringify({
        account_code: { _eq: accountCode },
        is_active: { _eq: true },
      }),
    );
    const result = await this.request<DirectusList<{ id: string }>>(
      url.pathname + url.search,
      userToken,
    );
    const accountId = result.data?.[0]?.id;
    if (!accountId)
      throw new BadRequestException(
        `Không tìm thấy tài khoản kế toán ${accountCode}`,
      );
    return accountId;
  }

  private async getBusinessPartnerName(partnerId: string, userToken: string) {
    const url = new URL(
      `/items/business_partners/${partnerId}`,
      this.directusUrl,
    );
    url.searchParams.append('fields[]', 'legal_name');
    url.searchParams.append('fields[]', 'display_name');
    url.searchParams.append('fields[]', 'partner_code');
    const result = await this.request<{
      data?: {
        legal_name?: string | null;
        display_name?: string | null;
        partner_code?: string | null;
      };
    }>(url.pathname + url.search, userToken);
    return (
      result.data?.legal_name ||
      result.data?.display_name ||
      result.data?.partner_code ||
      ''
    );
  }

  private paymentMethodToDebitAccountCode(paymentMethod: string) {
    return this.ACCOUNT_CODES[paymentMethod] || this.ACCOUNT_CODES.BANK;
  }

  private paymentMethodToVoucherType(paymentMethod: string) {
    if (paymentMethod === 'CASH') return 'CASH_RECEIPT';
    if (paymentMethod === 'EWALLET') return 'EWALLET_RECEIPT';
    return 'BANK_RECEIPT';
  }

  private buildReceiptNo(prefix: string, documentDate: string) {
    return `${prefix}-${documentDate.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async fetchJournalByReference(
    referenceType: string,
    referenceId: string,
    userToken: string,
  ) {
    const jeUrl = new URL('/items/journal_entries', this.directusUrl);
    jeUrl.searchParams.append('limit', '1');
    jeUrl.searchParams.append(
      'filter',
      JSON.stringify({
        reference_type: { _eq: referenceType },
        reference_id: { _eq: referenceId },
      }),
    );
    const journal = await this.request<DirectusList<JournalEntry>>(
      jeUrl.pathname + jeUrl.search,
      userToken,
    );
    return journal.data?.[0] || null;
  }

  private buildPaymentVoucherPayload(params: {
    voucherNo: string;
    voucherType: string;
    documentDate: string;
    postingDate: string;
    counterpartyId: string;
    counterpartyNameSnapshot: string;
    paymentMethod: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    currency?: string;
    description?: string;
    status?: string;
  }) {
    return {
      voucher_no: params.voucherNo,
      voucher_channel: 'MANUAL',
      voucher_direction: 'RECEIPT',
      voucher_type: params.voucherType,
      document_date: params.documentDate,
      posting_date: params.postingDate,
      counterparty_id: params.counterpartyId,
      counterparty_role: 'CUSTOMER',
      counterparty_name_snapshot: params.counterpartyNameSnapshot,
      counterparty_source: 'EXTERNAL',
      debit_account_id: params.debitAccountId,
      credit_account_id: params.creditAccountId,
      amount: params.amount,
      currency: params.currency || 'VND',
      description: params.description || '',
      status: params.status || 'DRAFT',
    };
  }

  private buildSalesInvoiceLinePayload(
    line: CreateArSalesInvoiceLineDto,
    index: number,
    arDocumentId: string,
    defaults: { revenueAccountId: string; taxAccountId: string },
  ) {
    const taxRate = Number(line.tax_rate ?? 10);
    return {
      ar_document_id: arDocumentId,
      line_no: line.line_no || index + 1,
      item_code: line.item_code,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      tax_rate: taxRate,
      revenue_account_id: line.revenue_account_id || defaults.revenueAccountId,
      tax_account_id:
        taxRate > 0
          ? line.tax_account_id || defaults.taxAccountId
          : line.tax_account_id,
      metadata: line.metadata || {},
    };
  }

  async createSalesInvoice(dto: CreateArSalesInvoiceDto, userToken: string) {
    if (!dto.lines?.length)
      throw new BadRequestException(
        'Hóa đơn cần ít nhất một dòng hàng/dịch vụ',
      );

    const [arAccountId, revenueAccountId, taxAccountId] = await Promise.all([
      dto.accounting_account_id
        ? Promise.resolve(dto.accounting_account_id)
        : this.getAccountIdByCode('131', userToken),
      this.getAccountIdByCode('511', userToken),
      this.getAccountIdByCode('3331', userToken),
    ]);

    try {
      const documentResult = await this.requestWrite<{ data: ArDocument }>(
        '/items/ar_documents',
        userToken,
        {
          method: 'POST',
          body: JSON.stringify({
            document_no: dto.document_no,
            document_type: 'INVOICE',
            business_partner_id: dto.business_partner_id,
            accounting_account_id: arAccountId,
            document_date: dto.document_date,
            posting_date: dto.posting_date,
            due_date: dto.due_date,
            currency: dto.currency || 'VND',
            exchange_rate: dto.exchange_rate ?? 1,
            total_amount: 0,
            status: 'DRAFT',
            source_type: 'AR_SALES_INVOICE',
            source_id: dto.document_no,
            reference_no: dto.reference_no,
            description: dto.description || '',
            metadata: dto.metadata || {},
          }),
        },
      );

      const document = documentResult.data;
      const lines: ArDocumentLine[] = [];
      for (const [index, line] of dto.lines.entries()) {
        const lineResult = await this.requestWrite<{ data: ArDocumentLine }>(
          '/items/ar_document_lines',
          userToken,
          {
            method: 'POST',
            body: JSON.stringify(
              this.buildSalesInvoiceLinePayload(line, index, document.id, {
                revenueAccountId,
                taxAccountId,
              }),
            ),
          },
        );
        lines.push(lineResult.data);
      }

      const refreshed = await this.request<{ data: ArDocument }>(
        `/items/ar_documents/${document.id}`,
        userToken,
      );
      return {
        message: 'Tạo hóa đơn bán hàng công nợ nháp thành công',
        data: { document: refreshed.data, lines },
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo hóa đơn AR', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tạo hóa đơn AR');
    }
  }

  async postDocument(id: string, userToken: string) {
    try {
      const documentResult = await this.request<{ data: ArDocument }>(
        `/items/ar_documents/${id}`,
        userToken,
      );
      const document = documentResult.data;
      if (
        ![
          'INVOICE',
          'IMMEDIATE_SALE',
          'CONTRACT_MILESTONE',
          'RETENTION',
        ].includes(document.document_type)
      ) {
        throw new BadRequestException(
          'Chỉ hỗ trợ post các chứng từ sales invoice trong Phase 2A',
        );
      }
      if (document.status !== 'DRAFT') {
        throw new BadRequestException(
          'Chỉ được post chứng từ trạng thái DRAFT',
        );
      }

      const posted = await this.requestWrite<{ data: ArDocument }>(
        `/items/ar_documents/${id}`,
        userToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'POSTED' }),
        },
      );

      const journalUrl = new URL('/items/journal_entries', this.directusUrl);
      journalUrl.searchParams.append('limit', '1');
      journalUrl.searchParams.append(
        'filter',
        JSON.stringify({
          reference_type: { _eq: 'ar_documents' },
          reference_id: { _eq: id },
        }),
      );
      const journal = await this.request<DirectusList<JournalEntry>>(
        journalUrl.pathname + journalUrl.search,
        userToken,
      );

      return {
        message: 'Post hóa đơn AR thành công và đã sinh bút toán',
        data: {
          document: posted.data,
          journal_entry: journal.data?.[0] || null,
        },
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi post AR document ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể post AR document');
    }
  }

  async reverseDocument(
    id: string,
    dto: ReverseArDocumentDto,
    userToken: string,
  ) {
    try {
      const documentResult = await this.request<{ data: ArDocument }>(
        `/items/ar_documents/${id}`,
        userToken,
      );
      const document = documentResult.data;
      if (
        ![
          'INVOICE',
          'IMMEDIATE_SALE',
          'CONTRACT_MILESTONE',
          'RETENTION',
        ].includes(document.document_type)
      ) {
        throw new BadRequestException(
          'Chỉ hỗ trợ reverse các chứng từ sales invoice trong Phase 2A',
        );
      }
      if (document.status !== 'POSTED') {
        throw new BadRequestException(
          'Chỉ được reverse chứng từ đã POSTED và chưa thanh toán',
        );
      }
      if (Number(document.settled_amount) > 0) {
        throw new BadRequestException(
          'Không reverse trực tiếp hóa đơn đã có thanh toán/settlement',
        );
      }

      const journalUrl = new URL('/items/journal_entries', this.directusUrl);
      journalUrl.searchParams.append('limit', '1');
      journalUrl.searchParams.append(
        'filter',
        JSON.stringify({
          reference_type: { _eq: 'ar_documents' },
          reference_id: { _eq: id },
        }),
      );
      const journalResult = await this.request<DirectusList<JournalEntry>>(
        journalUrl.pathname + journalUrl.search,
        userToken,
      );
      const originalJournal = journalResult.data?.[0];
      if (!originalJournal)
        throw new BadRequestException('Không tìm thấy bút toán gốc để reverse');

      const existingReversalUrl = new URL(
        '/items/journal_entries',
        this.directusUrl,
      );
      existingReversalUrl.searchParams.append('limit', '1');
      existingReversalUrl.searchParams.append(
        'filter',
        JSON.stringify({
          reference_type: { _eq: 'ar_documents_reversal' },
          reference_id: { _eq: id },
        }),
      );
      const existingReversal = await this.request<DirectusList<JournalEntry>>(
        existingReversalUrl.pathname + existingReversalUrl.search,
        userToken,
      );
      if (existingReversal.data?.[0])
        throw new BadRequestException('Hóa đơn này đã có bút toán reverse');

      const linesUrl = new URL('/items/journal_entry_lines', this.directusUrl);
      linesUrl.searchParams.append('limit', '-1');
      linesUrl.searchParams.append('sort[]', 'sort');
      linesUrl.searchParams.append(
        'filter',
        JSON.stringify({ journal_entry_id: { _eq: originalJournal.id } }),
      );
      const originalLines = await this.request<DirectusList<JournalEntryLine>>(
        linesUrl.pathname + linesUrl.search,
        userToken,
      );
      if (!originalLines.data?.length)
        throw new BadRequestException('Bút toán gốc không có dòng để reverse');

      const postingDate =
        dto.posting_date || new Date().toISOString().slice(0, 10);
      const total =
        Number(originalJournal.total_debit) ||
        Number(document.total_amount) ||
        0;
      const reversalEntry = await this.requestWrite<{ data: JournalEntry }>(
        '/items/journal_entries',
        userToken,
        {
          method: 'POST',
          body: JSON.stringify({
            voucher_no: `REV-${document.document_no}`,
            date: postingDate,
            description:
              dto.reason || `Reverse AR invoice ${document.document_no}`,
            status: 'posted',
            reference_type: 'ar_documents_reversal',
            reference_id: id,
            total_debit: total,
            total_credit: total,
          }),
        },
      );

      for (const [index, line] of originalLines.data.entries()) {
        await this.requestWrite<{ data: JournalEntryLine }>(
          '/items/journal_entry_lines',
          userToken,
          {
            method: 'POST',
            body: JSON.stringify({
              journal_entry_id: reversalEntry.data.id,
              account_id: line.account_id,
              debit: Number(line.credit) || 0,
              credit: Number(line.debit) || 0,
              description: `Reverse: ${line.description || document.document_no}`,
              sort: line.sort ?? (index + 1) * 10,
            }),
          },
        );
      }

      const reversed = await this.requestWrite<{ data: ArDocument }>(
        `/items/ar_documents/${id}`,
        userToken,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'REVERSED',
            metadata: {
              ...(document.metadata || {}),
              phase2a_reversal: {
                journal_entry_id: reversalEntry.data.id,
                posting_date: postingDate,
                reason: dto.reason || null,
                metadata: dto.metadata || {},
              },
            },
          }),
        },
      );

      return {
        message: 'Reverse hóa đơn AR thành công và đã sinh bút toán đảo',
        data: {
          document: reversed.data,
          reversal_journal_entry: reversalEntry.data,
        },
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi reverse AR document ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể reverse AR document');
    }
  }

  async updateDocument(
    id: string,
    dto: UpdateArDocumentDto,
    userToken: string,
  ) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.settled_amount !== undefined) {
      const docUrl = new URL(`/items/ar_documents/${id}`, this.directusUrl);
      docUrl.searchParams.append('fields[]', 'total_amount');
      const current = await this.request<{
        data?: { total_amount?: number | string };
      }>(docUrl.pathname + docUrl.search, userToken);
      const totalAmount = Number(
        current.data?.total_amount ?? dto.total_amount ?? 0,
      );
      const settledAmount = Math.min(
        Math.max(Number(dto.settled_amount) || 0, 0),
        totalAmount,
      );
      payload.settled_amount = settledAmount;
      payload.status =
        settledAmount <= 0
          ? 'POSTED'
          : settledAmount >= totalAmount
            ? 'SETTLED'
            : 'PARTIAL';
    }
    const result = await this.requestWrite<{ data: ArDocument }>(
      `/items/ar_documents/${id}`,
      userToken,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    return { message: 'Cập nhật AR document thành công', data: result.data };
  }

  async deleteDocument(id: string, userToken: string) {
    await this.ensureDocumentCanDelete(id, userToken);
    await this.requestWrite<any>(`/items/ar_documents/${id}`, userToken, {
      method: 'DELETE',
    });
    return { message: 'Xóa AR document thành công' };
  }

  async findApplications(query: ArWorkbenchQueryDto, userToken: string) {
    const { page, pageSize, offset, sort } = this.pagination(query);
    const url = new URL('/items/ar_applications', this.directusUrl);
    url.searchParams.append('limit', pageSize.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('meta', 'filter_count');
    url.searchParams.append('sort[]', sort);
    const result = await this.request<DirectusList<any>>(
      url.pathname + url.search,
      userToken,
    );
    const total = result.meta?.filter_count || 0;
    return {
      items: result.data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createApplication(dto: CreateArApplicationDto, userToken: string) {
    if (!dto.target_document_id && !dto.payment_voucher_id) {
      throw new BadRequestException(
        'Application cần target_document_id hoặc payment_voucher_id',
      );
    }
    const result = await this.requestWrite<{ data: any }>(
      '/items/ar_applications',
      userToken,
      {
        method: 'POST',
        body: JSON.stringify({ ...dto, status: dto.status || 'POSTED' }),
      },
    );
    return { message: 'Tạo AR application thành công', data: result.data };
  }

  async findCollectionActivities(
    query: ArWorkbenchQueryDto,
    userToken: string,
  ) {
    const { page, pageSize, offset, sort } = this.pagination(query);
    const url = new URL('/items/ar_collection_activities', this.directusUrl);
    url.searchParams.append('limit', pageSize.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('meta', 'filter_count');
    url.searchParams.append('sort[]', sort);
    if (query.business_partner_id) {
      url.searchParams.append(
        'filter',
        JSON.stringify({
          business_partner_id: { _eq: query.business_partner_id },
        }),
      );
    }
    const result = await this.request<DirectusList<any>>(
      url.pathname + url.search,
      userToken,
    );
    const total = result.meta?.filter_count || 0;
    return {
      items: result.data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async createCollectionActivity(
    dto: CreateArCollectionActivityDto,
    userToken: string,
  ) {
    const result = await this.requestWrite<{ data: any }>(
      '/items/ar_collection_activities',
      userToken,
      {
        method: 'POST',
        body: JSON.stringify({
          ...dto,
          activity_date:
            dto.activity_date || new Date().toISOString().slice(0, 10),
        }),
      },
    );
    return {
      message: 'Tạo hoạt động thu hồi công nợ thành công',
      data: result.data,
    };
  }

  async getSummary(query: ArWorkbenchQueryDto, userToken: string) {
    const url = new URL('/items/ar_documents', this.directusUrl);
    url.searchParams.append('limit', '-1');
    url.searchParams.append('fields[]', 'document_type');
    url.searchParams.append('fields[]', 'status');
    url.searchParams.append('fields[]', 'due_date');
    url.searchParams.append('fields[]', 'total_amount');
    url.searchParams.append('fields[]', 'settled_amount');
    url.searchParams.append('fields[]', 'open_amount');
    this.appendDocumentFilter(url, query);
    const result = await this.request<DirectusList<ArDocument>>(
      url.pathname + url.search,
      userToken,
    );
    const today = new Date().toISOString().slice(0, 10);
    const by_type: Record<
      string,
      { count: number; open_amount: number; total_amount: number }
    > = {};
    const totals = {
      count: 0,
      total_amount: 0,
      settled_amount: 0,
      open_amount: 0,
      overdue_amount: 0,
    };
    for (const doc of result.data || []) {
      const total = Number(doc.total_amount) || 0;
      const settled = Number(doc.settled_amount) || 0;
      const open = Number(doc.open_amount) || 0;
      totals.count += 1;
      totals.total_amount += total;
      totals.settled_amount += settled;
      totals.open_amount += open;
      if (
        doc.due_date &&
        doc.due_date < today &&
        ['POSTED', 'PARTIAL'].includes(doc.status)
      )
        totals.overdue_amount += open;
      by_type[doc.document_type] = by_type[doc.document_type] || {
        count: 0,
        open_amount: 0,
        total_amount: 0,
      };
      by_type[doc.document_type].count += 1;
      by_type[doc.document_type].open_amount += open;
      by_type[doc.document_type].total_amount += total;
    }
    return { totals, by_type, coverage: AR_COVERAGE };
  }

  getCoverage() {
    return { items: AR_COVERAGE, total: AR_COVERAGE.length };
  }

  // ─── Payment Voucher / Receipt ───────────────────────────────────────────

  private readonly ACCOUNT_CODES: Record<string, string> = {
    CASH: '111',
    BANK: '112',
    EWALLET: '113',
    AR: '131',
    WRITEOFF_EXP: '635',
    SUSPENSE: '3388',
  };

  async findPaymentVouchers(query: ArWorkbenchQueryDto, userToken: string) {
    try {
      const { page, pageSize, offset, sort } = this.pagination(query);
      const url = new URL('/items/payment_vouchers', this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      const filterAnd: any[] = [
        { voucher_direction: { _eq: 'RECEIPT' } },
        { counterparty_role: { _in: ['CUSTOMER', 'customer'] } },
      ];
      if (query.business_partner_id)
        filterAnd.push({ counterparty_id: { _eq: query.business_partner_id } });
      if (query.status) filterAnd.push({ status: { _eq: query.status } });
      url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      const result = await this.request<DirectusList<any>>(
        url.pathname + url.search,
        userToken,
      );
      const total = result.meta?.filter_count || 0;
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách phiếu thu', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách phiếu thu',
      );
    }
  }

  async createPaymentReceipt(dto: CreatePaymentReceiptDto, userToken: string) {
    try {
      const debitAccountId =
        dto.debit_account_id ||
        (await this.getAccountIdByCode(
          this.paymentMethodToDebitAccountCode(dto.payment_method),
          userToken,
        ));
      const creditAccountId =
        dto.credit_account_id ||
        (await this.getAccountIdByCode(this.ACCOUNT_CODES.AR, userToken));

      const postingDate = dto.posting_date || dto.document_date;
      const voucher: any = this.buildPaymentVoucherPayload({
        voucherNo:
          dto.voucher_no || this.buildReceiptNo('REC', dto.document_date),
        voucherType: this.paymentMethodToVoucherType(dto.payment_method),
        documentDate: dto.document_date,
        postingDate,
        counterpartyId: dto.counterparty_id,
        counterpartyNameSnapshot:
          dto.counterparty_name_snapshot ||
          (await this.getBusinessPartnerName(dto.counterparty_id, userToken)),
        paymentMethod: dto.payment_method,
        debitAccountId,
        creditAccountId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
      });

      const created = await this.requestWrite<{ data: any }>(
        '/items/payment_vouchers',
        userToken,
        { method: 'POST', body: JSON.stringify(voucher) },
      );
      const voucherId = created.data.id;

      // Auto-allocate if allocations provided
      const applications: any[] = [];
      if (dto.allocations?.length) {
        for (const alloc of dto.allocations) {
          const appNo = `APP-${dto.voucher_no || voucherId.slice(0, 8)}-${alloc.target_document_id.slice(0, 6)}`;
          const appPayload: any = {
            application_no: appNo,
            application_type: 'PAYMENT',
            payment_voucher_id: voucherId,
            target_document_id: alloc.target_document_id,
            application_date: dto.document_date,
            amount: alloc.amount,
            status: 'POSTED',
          };
          if ((alloc.writeoff_amount || 0) > 0) {
            appPayload.writeoff_amount = alloc.writeoff_amount;
            appPayload.metadata = {
              writeoff_account_id:
                alloc.writeoff_account_id ||
                (await this.getAccountIdByCode(
                  this.ACCOUNT_CODES['WRITEOFF_EXP'],
                  userToken,
                )),
              writeoff_reason: alloc.reason || 'Writeoff chênh lệch nhỏ',
            };
          }
          const app = await this.requestWrite<{ data: any }>(
            '/items/ar_applications',
            userToken,
            { method: 'POST', body: JSON.stringify(appPayload) },
          );
          applications.push(app.data);
        }
      }

      return {
        message: 'Tạo phiếu thu nháp thành công',
        data: { voucher: created.data, applications },
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo phiếu thu', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tạo phiếu thu');
    }
  }

  async postPaymentVoucher(id: string, userToken: string) {
    try {
      const voucherResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
      );
      const voucher = voucherResult.data;
      if (!['RECEIPT'].includes(voucher.voucher_direction)) {
        throw new BadRequestException('Endpoint này chỉ dùng cho phiếu thu');
      }
      if (voucher.status !== 'DRAFT') {
        throw new BadRequestException(
          'Chỉ được post phiếu thu trạng thái DRAFT',
        );
      }

      const posted = await this.requestWrite<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
        { method: 'PATCH', body: JSON.stringify({ status: 'POSTED' }) },
      );

      // Fetch JE created by trigger
      const jeUrl = new URL('/items/journal_entries', this.directusUrl);
      jeUrl.searchParams.append('limit', '1');
      jeUrl.searchParams.append(
        'filter',
        JSON.stringify({
          reference_type: { _eq: 'payment_vouchers' },
          reference_id: { _eq: id },
        }),
      );
      const journal = await this.request<DirectusList<JournalEntry>>(
        jeUrl.pathname + jeUrl.search,
        userToken,
      );

      return {
        message: 'Post phiếu thu thành công và đã sinh bút toán',
        data: {
          voucher: posted.data,
          journal_entry: journal.data?.[0] || null,
        },
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi post phiếu thu ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể post phiếu thu');
    }
  }

  async allocatePayment(
    voucherId: string,
    allocations: {
      target_document_id: string;
      amount: number;
      writeoff_amount?: number;
      writeoff_account_id?: string;
      reason?: string;
    }[],
    userToken: string,
  ) {
    try {
      if (!allocations?.length)
        throw new BadRequestException('Cần ít nhất một allocation');

      const voucherResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${voucherId}`,
        userToken,
      );
      const voucher = voucherResult.data;
      if (voucher.status !== 'POSTED') {
        throw new BadRequestException('Chỉ allocate phiếu thu đã POSTED');
      }

      const writeoffAccountId = await this.getAccountIdByCode(
        this.ACCOUNT_CODES['WRITEOFF_EXP'],
        userToken,
      );

      const results: any[] = [];
      for (const alloc of allocations) {
        const appNo = `APP-${voucher.voucher_no || voucherId.slice(0, 8)}-${alloc.target_document_id.slice(0, 6)}-${Date.now()}`;
        const appPayload: any = {
          application_no: appNo,
          application_type: 'PAYMENT',
          payment_voucher_id: voucherId,
          target_document_id: alloc.target_document_id,
          application_date: voucher.posting_date || voucher.document_date,
          amount: alloc.amount,
          status: 'POSTED',
        };
        if ((alloc.writeoff_amount || 0) > 0) {
          appPayload.writeoff_amount = alloc.writeoff_amount;
          appPayload.metadata = {
            writeoff_account_id: alloc.writeoff_account_id || writeoffAccountId,
            writeoff_reason: alloc.reason || 'Writeoff chênh lệch nhỏ',
          };
        }
        const app = await this.requestWrite<{ data: any }>(
          '/items/ar_applications',
          userToken,
          { method: 'POST', body: JSON.stringify(appPayload) },
        );
        results.push(app.data);
      }
      return {
        message: `Allocate ${results.length} khoản thành công`,
        data: results,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi allocate phiếu thu ${voucherId}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể allocate phiếu thu');
    }
  }

  async reversePaymentVoucher(
    id: string,
    dto: { reason?: string; posting_date?: string },
    userToken: string,
  ) {
    try {
      const voucherResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
      );
      const voucher = voucherResult.data;
      if (voucher.voucher_direction !== 'RECEIPT') {
        throw new BadRequestException('Endpoint này chỉ dùng cho phiếu thu');
      }
      if (voucher.status !== 'POSTED') {
        throw new BadRequestException('Chỉ được reverse phiếu thu đã POSTED');
      }

      // Check no active allocations
      const appUrl = new URL('/items/ar_applications', this.directusUrl);
      appUrl.searchParams.append('limit', '1');
      appUrl.searchParams.append(
        'filter',
        JSON.stringify({
          payment_voucher_id: { _eq: id },
          status: { _eq: 'POSTED' },
        }),
      );
      const apps = await this.request<DirectusList<any>>(
        appUrl.pathname + appUrl.search,
        userToken,
      );
      if (apps.data?.length) {
        throw new BadRequestException(
          'Phiếu thu đã có allocation đang active — cần hủy allocation trước khi reverse',
        );
      }

      const cancelled = await this.requestWrite<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'CANCELLED',
            cancel_reason: dto.reason || 'Reverse phiếu thu',
            cancelled_at: new Date().toISOString(),
          }),
        },
      );

      const reversalJournal = await this.fetchJournalByReference(
        'payment_vouchers_reversal',
        id,
        userToken,
      );

      return {
        message: 'Reverse phiếu thu thành công',
        data: {
          voucher: cancelled.data,
          reversal_journal_entry: reversalJournal,
        },
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi reverse phiếu thu ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể reverse phiếu thu');
    }
  }

  async findCustomerAdvances(query: ArWorkbenchQueryDto, userToken: string) {
    try {
      const { page, pageSize, offset, sort } = this.pagination(query);
      const url = new URL('/items/payment_vouchers', this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      const filterAnd: any[] = [
        { voucher_type: { _eq: 'CUSTOMER_ADVANCE_RECEIPT' } },
      ];
      if (query.business_partner_id)
        filterAnd.push({ counterparty_id: { _eq: query.business_partner_id } });
      if (query.status) filterAnd.push({ status: { _eq: query.status } });
      url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      const result = await this.request<DirectusList<any>>(
        url.pathname + url.search,
        userToken,
      );
      const total = result.meta?.filter_count || 0;
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách đặt cọc khách hàng', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách đặt cọc');
    }
  }

  // ─── UC#4 Apply Advance to Invoice ──────────────────────────────────────────

  async findAdvanceApplications(
    query: {
      advance_voucher_id?: string;
      ar_document_id?: string;
      page?: number;
      pageSize?: number;
    },
    userToken: string,
  ) {
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const url = new URL('/items/ar_applications', this.directusUrl);
      url.searchParams.append('limit', String(pageSize));
      url.searchParams.append('offset', String((page - 1) * pageSize));
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort', '-created_at');
      const filterAnd: any[] = [
        { application_type: { _eq: 'ADVANCE_APPLICATION' } },
      ];
      if (query.advance_voucher_id)
        filterAnd.push({
          payment_voucher_id: { _eq: query.advance_voucher_id },
        });
      if (query.ar_document_id)
        filterAnd.push({ target_document_id: { _eq: query.ar_document_id } });
      url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      const result = await this.request<DirectusList<any>>(
        url.pathname + url.search,
        userToken,
      );
      const total = result.meta?.filter_count || 0;
      return {
        items: result.data || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách cấn trừ cọc', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        'Không thể lấy danh sách cấn trừ cọc',
      );
    }
  }

  async applyAdvanceToInvoice(
    dto: ApplyAdvanceToInvoiceDto,
    userToken: string,
  ) {
    try {
      // 1. Validate advance voucher
      const advResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${dto.advance_voucher_id}`,
        userToken,
      );
      const adv = advResult.data;
      if (adv.voucher_type !== 'CUSTOMER_ADVANCE_RECEIPT') {
        throw new BadRequestException(
          'Voucher không phải phiếu đặt cọc khách hàng',
        );
      }
      if (adv.status !== 'POSTED') {
        throw new BadRequestException('Phiếu đặt cọc phải ở trạng thái POSTED');
      }
      const remaining = Number(adv.ar_advance_remaining_amount || 0);
      if (remaining <= 0) {
        throw new BadRequestException(
          'Phiếu đặt cọc không còn số dư để cấn trừ',
        );
      }

      // 2. Validate AR document
      const docResult = await this.request<{ data: any }>(
        `/items/ar_documents/${dto.ar_document_id}`,
        userToken,
      );
      const doc = docResult.data;
      if (!['POSTED', 'PARTIAL'].includes(doc.status)) {
        throw new BadRequestException(
          'AR document phải ở trạng thái POSTED hoặc PARTIAL',
        );
      }
      const openAmount = Number(doc.open_amount || 0);
      if (openAmount <= 0) {
        throw new BadRequestException(
          'Invoice không còn công nợ mở để cấn trừ',
        );
      }

      // 3. Validate amount
      const maxApply = Math.min(remaining, openAmount);
      if (dto.amount > maxApply + 0.001) {
        throw new BadRequestException(
          `Số tiền cấn trừ (${dto.amount}) vượt quá giới hạn cho phép: min(advance_remaining=${remaining}, invoice_open=${openAmount}) = ${maxApply}`,
        );
      }

      // 4. Build and post ar_application
      const applicationNo =
        dto.application_no ||
        `ADVA-${adv.voucher_no?.slice(-8) || dto.advance_voucher_id.slice(0, 8)}-${Date.now()}`;

      const appPayload = {
        application_no: applicationNo,
        application_type: 'ADVANCE_APPLICATION',
        payment_voucher_id: dto.advance_voucher_id,
        target_document_id: dto.ar_document_id, // invoice is target
        application_date: dto.application_date,
        amount: dto.amount,
        status: 'POSTED',
        reason: dto.reason || `Cấn trừ tiền cọc ${adv.voucher_no} vào invoice`,
        metadata: {
          advance_voucher_no: adv.voucher_no,
          advance_remaining_before: remaining,
          invoice_open_before: openAmount,
        },
      };

      const app = await this.requestWrite<{ data: any }>(
        '/items/ar_applications',
        userToken,
        { method: 'POST', body: JSON.stringify(appPayload) },
      );

      // 5. Fetch updated states
      const [updatedAdv, updatedDoc] = await Promise.all([
        this.request<{ data: any }>(
          `/items/payment_vouchers/${dto.advance_voucher_id}`,
          userToken,
        ),
        this.request<{ data: any }>(
          `/items/ar_documents/${dto.ar_document_id}`,
          userToken,
        ),
      ]);

      return {
        message: `Cấn trừ ${dto.amount.toLocaleString('vi-VN')} đ thành công`,
        data: {
          application: app.data,
          advance_after: {
            id: updatedAdv.data.id,
            voucher_no: updatedAdv.data.voucher_no,
            ar_advance_remaining_amount:
              updatedAdv.data.ar_advance_remaining_amount,
            ar_advance_status: updatedAdv.data.ar_advance_status,
          },
          invoice_after: {
            id: updatedDoc.data.id,
            document_no: updatedDoc.data.document_no,
            open_amount: updatedDoc.data.open_amount,
            settled_amount: updatedDoc.data.settled_amount,
            status: updatedDoc.data.status,
          },
        },
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi cấn trừ tiền cọc vào invoice', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể cấn trừ tiền cọc');
    }
  }

  async reverseAdvanceApplication(
    applicationId: string,
    dto: { reason?: string },
    userToken: string,
  ) {
    try {
      const appResult = await this.request<{ data: any }>(
        `/items/ar_applications/${applicationId}`,
        userToken,
      );
      const app = appResult.data;
      if (app.application_type !== 'ADVANCE_APPLICATION') {
        throw new BadRequestException('Không phải bản ghi cấn trừ cọc');
      }
      if (app.status !== 'POSTED') {
        throw new BadRequestException('Chỉ được reverse bản ghi POSTED');
      }
      if (app.reversed_by_application_id) {
        throw new BadRequestException('Bản ghi đã bị reverse trước đó');
      }

      const metadata = {
        ...(app.metadata || {}),
        reversal_reason: dto.reason || `Hủy cấn trừ cọc ${app.application_no}`,
        reversed_at: new Date().toISOString(),
      };

      const reversed = await this.requestWrite<{ data: any }>(
        `/items/ar_applications/${applicationId}`,
        userToken,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REVERSED', metadata }),
        },
      );

      return {
        message:
          'Hủy cấn trừ cọc thành công, đã khôi phục số dư advance và invoice',
        data: {
          original_application_id: applicationId,
          reversal: reversed.data,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Lỗi khi reverse advance application ${applicationId}`,
        error,
      );
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể hủy cấn trừ cọc');
    }
  }

  async createCustomerAdvance(
    dto: CreateCustomerAdvanceDto,
    userToken: string,
  ) {
    try {
      const debitAccountId =
        dto.debit_account_id ||
        (await this.getAccountIdByCode(
          this.paymentMethodToDebitAccountCode(dto.payment_method),
          userToken,
        ));
      const creditAccountId =
        dto.credit_account_id ||
        (await this.getAccountIdByCode(this.ACCOUNT_CODES.AR, userToken));
      const postingDate = dto.posting_date || dto.document_date;
      const voucher = this.buildPaymentVoucherPayload({
        voucherNo:
          dto.voucher_no || this.buildReceiptNo('ADV', dto.document_date),
        voucherType: 'CUSTOMER_ADVANCE_RECEIPT',
        documentDate: dto.document_date,
        postingDate,
        counterpartyId: dto.counterparty_id,
        counterpartyNameSnapshot:
          dto.counterparty_name_snapshot ||
          (await this.getBusinessPartnerName(dto.counterparty_id, userToken)),
        paymentMethod: dto.payment_method,
        debitAccountId,
        creditAccountId,
        amount: dto.amount,
        currency: dto.currency,
        description:
          dto.description ||
          'Khách đặt cọc trước — chưa ghi nhận doanh thu/VAT',
      });

      const created = await this.requestWrite<{ data: any }>(
        '/items/payment_vouchers',
        userToken,
        { method: 'POST', body: JSON.stringify(voucher) },
      );
      return {
        message: 'Tạo phiếu đặt cọc nháp thành công',
        data: created.data,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo phiếu đặt cọc khách hàng', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể tạo phiếu đặt cọc');
    }
  }

  async postCustomerAdvance(id: string, userToken: string) {
    try {
      const voucherResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
      );
      const voucher = voucherResult.data;
      if (voucher.voucher_type !== 'CUSTOMER_ADVANCE_RECEIPT') {
        throw new BadRequestException(
          'Voucher không phải phiếu đặt cọc khách hàng',
        );
      }
      if (voucher.status !== 'DRAFT') {
        throw new BadRequestException(
          'Chỉ được post phiếu đặt cọc trạng thái DRAFT',
        );
      }
      const posted = await this.requestWrite<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
        { method: 'PATCH', body: JSON.stringify({ status: 'POSTED' }) },
      );
      const journal = await this.fetchJournalByReference(
        'payment_vouchers',
        id,
        userToken,
      );
      return {
        message:
          'Post phiếu đặt cọc thành công và đã sinh bút toán N111/112/113 C131 advance',
        data: { voucher: posted.data, journal_entry: journal },
      };
    } catch (error: any) {
      this.logger.error(`Lỗi khi post phiếu đặt cọc ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể post phiếu đặt cọc');
    }
  }

  async reverseCustomerAdvance(
    id: string,
    dto: { reason?: string; posting_date?: string },
    userToken: string,
  ) {
    try {
      const voucherResult = await this.request<{ data: any }>(
        `/items/payment_vouchers/${id}`,
        userToken,
      );
      if (voucherResult.data?.voucher_type !== 'CUSTOMER_ADVANCE_RECEIPT') {
        throw new BadRequestException(
          'Voucher không phải phiếu đặt cọc khách hàng',
        );
      }
      return this.reversePaymentVoucher(id, dto, userToken);
    } catch (error: any) {
      this.logger.error(`Lỗi khi reverse phiếu đặt cọc ${id}`, error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể reverse phiếu đặt cọc');
    }
  }
}
