import {
  Injectable,
  Inject,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createDirectus,
  readItem,
  readItems,
  createItem,
  updateItem,
  deleteItem,
  deleteItems,
  rest,
  staticToken,
} from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { PaymentVoucherQueryDto } from './dto/payment-voucher-query.dto';
import { PaymentVoucherSummaryQueryDto } from './dto/payment-voucher-summary-query.dto';
import { CreatePaymentVouchersDto } from './dto/create-payment-vouchers.dto';
import { UpdatePaymentVouchersDto } from './dto/update-payment-vouchers.dto';
import {
  VoucherApproveDto,
  VoucherRejectDto,
  VoucherCancelDto,
} from './dto/voucher-action.dto';
import {
  rethrowHttpException,
  throwDirectusResponseError,
  throwDirectusSdkError,
} from '../common/utils/directus-error.util';

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['POSTED', 'CANCELLED'],
  REJECTED: [],
  POSTED: [],
  CANCELLED: [],
};

@Injectable()
export class PaymentVouchersService {
  private readonly logger = new Logger(PaymentVouchersService.name);
  private readonly collection = 'payment_vouchers';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
  ) {}

  private getClient(userToken: string) {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(userToken)).with(rest());
  }

  private getAdminClient() {
    const url = this.configService.getOrThrow<string>('DIRECTUS_URL');
    return createDirectus(url).with(staticToken(this.adminToken)).with(rest());
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private async getCurrentUserId(userToken: string): Promise<string> {
    const res = await fetch(`${this.directusUrl}/users/me?fields=id`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok)
      throw new UnauthorizedException('Không xác thực được người dùng');
    const { data } = await res.json();
    return data.id;
  }

  private async fetchEmployeeSnapshot(
    employeeId: string,
  ): Promise<Record<string, string>> {
    const url = new URL(`/items/employees/${employeeId}`, this.directusUrl);
    url.searchParams.append('fields[]', 'id');
    url.searchParams.append('fields[]', 'full_name');
    url.searchParams.append('fields[]', 'phone');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok)
      throw new BadRequestException(`Không tìm thấy nhân viên: ${employeeId}`);
    const { data } = await res.json();
    return {
      counterparty_name_snapshot: data.full_name || '',
      counterparty_phone_snapshot: data.phone || '',
      counterparty_identity_no_snapshot: '',
    };
  }

  private async fetchBusinessPartnerSnapshot(
    counterpartyId: string,
  ): Promise<Record<string, string>> {
    const res = await fetch(
      `${this.directusUrl}/items/business_partners/${counterpartyId}`,
      {
        headers: { Authorization: `Bearer ${this.adminToken}` },
      },
    );
    if (!res.ok)
      throw new BadRequestException(
        `Không tìm thấy đối tác: ${counterpartyId}`,
      );
    const { data } = await res.json();
    return {
      counterparty_name_snapshot: data.display_name || data.name || '',
      counterparty_tax_code_snapshot: data.tax_code || '',
      counterparty_address_snapshot: data.address || '',
      counterparty_phone_snapshot: data.phone || '',
    };
  }

  private async fetchBankSnapshot(
    bankAccountId: string,
  ): Promise<Record<string, string>> {
    const res = await fetch(
      `${this.directusUrl}/items/business_partner_bank_accounts/${bankAccountId}`,
      { headers: { Authorization: `Bearer ${this.adminToken}` } },
    );
    if (!res.ok) return {};
    const { data } = await res.json();
    return {
      beneficiary_bank_name_snapshot: data.bank_name || '',
      beneficiary_bank_account_snapshot: data.account_number || '',
      beneficiary_account_holder_snapshot: data.account_holder || '',
    };
  }

  private async adminListItems(
    collection: string,
    options: {
      fields: string[];
      search?: string;
      filter?: Record<string, any>;
      page?: number;
      pageSize?: number;
      sort?: string;
    },
  ) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const url = new URL(`/items/${collection}`, this.directusUrl);

    url.searchParams.append('limit', pageSize.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('meta', 'filter_count');
    for (const field of options.fields) {
      url.searchParams.append('fields[]', field);
    }
    if (options.sort) url.searchParams.append('sort[]', options.sort);
    if (options.search) url.searchParams.append('search', options.search);
    if (options.filter) {
      url.searchParams.append('filter', JSON.stringify(options.filter));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.warn(
        `Admin lookup ${collection} bị Directus từ chối: ${response.status} ${body}`,
      );
      const retryWithoutMetaUrl = new URL(url.toString());
      retryWithoutMetaUrl.searchParams.delete('meta');
      const retryResponse = await fetch(retryWithoutMetaUrl.toString(), {
        headers: { Authorization: `Bearer ${this.adminToken}` },
      });

      if (retryResponse.ok) {
        const retryResult = await retryResponse.json();
        return {
          items: retryResult.data || [],
          total: retryResult.data?.length || 0,
          page,
          pageSize,
          totalPages: 1,
        };
      }

      await throwDirectusResponseError(
        retryResponse,
        `Không thể lấy dữ liệu ${collection}`,
      );
    }

    const result = await response.json();
    const total = result.meta?.filter_count || 0;

    return {
      items: result.data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Validate + build snapshot overrides based on counterparty_source */
  private async buildCounterpartyPayload(
    dto: Pick<
      CreatePaymentVouchersDto,
      | 'counterparty_source'
      | 'employee_id'
      | 'counterparty_id'
      | 'beneficiary_bank_account_id'
      | 'counterparty_name_snapshot'
      | 'counterparty_phone_snapshot'
      | 'counterparty_identity_no_snapshot'
      | 'counterparty_tax_code_snapshot'
      | 'counterparty_address_snapshot'
      | 'beneficiary_bank_name_snapshot'
      | 'beneficiary_bank_account_snapshot'
      | 'beneficiary_account_holder_snapshot'
    >,
  ): Promise<Record<string, any>> {
    const {
      counterparty_source,
      employee_id,
      counterparty_id,
      beneficiary_bank_account_id,
    } = dto;

    if (counterparty_source === 'INTERNAL') {
      if (!employee_id)
        throw new BadRequestException(
          'employee_id bắt buộc khi counterparty_source = INTERNAL',
        );
      if (counterparty_id)
        throw new BadRequestException(
          'Không được truyền counterparty_id khi counterparty_source = INTERNAL',
        );

      const snapshot = await this.fetchEmployeeSnapshot(employee_id);
      return {
        counterparty_source,
        employee_id,
        counterparty_id: null,
        ...snapshot,
        // FE override takes precedence if explicitly provided
        ...(dto.counterparty_name_snapshot && {
          counterparty_name_snapshot: dto.counterparty_name_snapshot,
        }),
        ...(dto.counterparty_phone_snapshot && {
          counterparty_phone_snapshot: dto.counterparty_phone_snapshot,
        }),
        ...(dto.counterparty_identity_no_snapshot && {
          counterparty_identity_no_snapshot:
            dto.counterparty_identity_no_snapshot,
        }),
      };
    }

    if (counterparty_source === 'EXTERNAL') {
      if (!counterparty_id)
        throw new BadRequestException(
          'counterparty_id bắt buộc khi counterparty_source = EXTERNAL',
        );
      if (employee_id)
        throw new BadRequestException(
          'Không được truyền employee_id khi counterparty_source = EXTERNAL',
        );

      const snapshot = await this.fetchBusinessPartnerSnapshot(counterparty_id);
      const bankSnapshot = beneficiary_bank_account_id
        ? await this.fetchBankSnapshot(beneficiary_bank_account_id)
        : {};

      return {
        counterparty_source,
        counterparty_id,
        employee_id: null,
        ...snapshot,
        ...bankSnapshot,
        ...(dto.counterparty_name_snapshot && {
          counterparty_name_snapshot: dto.counterparty_name_snapshot,
        }),
        ...(dto.counterparty_tax_code_snapshot && {
          counterparty_tax_code_snapshot: dto.counterparty_tax_code_snapshot,
        }),
        ...(dto.counterparty_address_snapshot && {
          counterparty_address_snapshot: dto.counterparty_address_snapshot,
        }),
        ...(dto.counterparty_phone_snapshot && {
          counterparty_phone_snapshot: dto.counterparty_phone_snapshot,
        }),
        ...(dto.beneficiary_bank_name_snapshot && {
          beneficiary_bank_name_snapshot: dto.beneficiary_bank_name_snapshot,
        }),
        ...(dto.beneficiary_bank_account_snapshot && {
          beneficiary_bank_account_snapshot:
            dto.beneficiary_bank_account_snapshot,
        }),
        ...(dto.beneficiary_account_holder_snapshot && {
          beneficiary_account_holder_snapshot:
            dto.beneficiary_account_holder_snapshot,
        }),
      };
    }

    throw new BadRequestException(
      'counterparty_source phải là INTERNAL hoặc EXTERNAL',
    );
  }

  private validateChannel(
    dto: Pick<
      CreatePaymentVouchersDto,
      'voucher_channel' | 'cash_fund_id' | 'company_bank_account_id'
    >,
  ) {
    if (dto.voucher_channel === 'CASH' && !dto.cash_fund_id) {
      throw new BadRequestException(
        'cash_fund_id bắt buộc khi voucher_channel = CASH',
      );
    }
    if (dto.voucher_channel === 'BANK' && !dto.company_bank_account_id) {
      throw new BadRequestException(
        'company_bank_account_id bắt buộc khi voucher_channel = BANK',
      );
    }
  }

  private async loadVoucher(id: string, userToken: string): Promise<any> {
    const client = this.getClient(userToken);
    try {
      return await (client as any).request(
        (readItem as any)(this.collection, id),
      );
    } catch {
      throw new NotFoundException(`Không tìm thấy phiếu thu chi: ${id}`);
    }
  }

  private async writeApprovalLog(
    voucherId: string,
    action: string,
    note: string | undefined,
    userId: string,
    fromStatus: string | undefined,
    toStatus: string,
    client: any,
  ) {
    try {
      await client.request(
        (createItem as any)('payment_voucher_approval_logs', {
          payment_voucher_id: voucherId,
          action,
          note: note || null,
          action_by: userId,
          from_status: fromStatus || null,
          to_status: toStatus,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `Không ghi được approval log cho ${voucherId}: ${err.message}`,
      );
    }
  }


  private async resolveCashBankTagPreset(dto: {
    cash_bank_tag_preset_id?: string;
    cash_bank_tag_code?: string;
    voucher_channel?: string;
    voucher_direction?: string;
  }): Promise<Record<string, any>> {
    const presetRef = dto.cash_bank_tag_preset_id || dto.cash_bank_tag_code;
    if (!presetRef) return {};

    const filter = dto.cash_bank_tag_preset_id
      ? { id: { _eq: dto.cash_bank_tag_preset_id } }
      : { code: { _eq: dto.cash_bank_tag_code } };
    const url = new URL('/items/cash_bank_tag_presets', this.directusUrl);
    url.searchParams.append('limit', '1');
    url.searchParams.append(
      'fields[]',
      'id,code,label,voucher_channel,voucher_direction,debit_account_id,credit_account_id,is_active',
    );
    url.searchParams.append('filter', JSON.stringify(filter));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!response.ok) {
      await throwDirectusResponseError(
        response,
        'Không thể lấy cash/bank tag preset',
      );
    }

    const json = await response.json();
    const preset = json.data?.[0];
    if (!preset || preset.is_active === false) {
      throw new BadRequestException('Cash/bank tag preset không tồn tại hoặc đã tắt');
    }
    if (preset.voucher_channel && dto.voucher_channel && preset.voucher_channel !== dto.voucher_channel) {
      throw new BadRequestException('Cash/bank tag preset không khớp kênh CASH/BANK');
    }
    if (preset.voucher_direction && dto.voucher_direction && preset.voucher_direction !== dto.voucher_direction) {
      throw new BadRequestException('Cash/bank tag preset không khớp chiều thu/chi');
    }

    return {
      cash_bank_tag_preset_id: preset.id,
      debit_account_id: preset.debit_account_id,
      credit_account_id: preset.credit_account_id,
    };
  }

  private stripCashBankTransientFields<T extends Record<string, any>>(dto: T): Omit<T, 'cash_bank_tag_code' | 'related_documents'> {
    const { cash_bank_tag_code, related_documents, ...payload } = dto;
    return payload;
  }

  private async syncRelatedDocuments(
    paymentVoucherId: string,
    relatedDocuments: any[] | undefined,
  ) {
    if (relatedDocuments === undefined) return;

    const listUrl = new URL('/items/cash_bank_related_documents', this.directusUrl);
    listUrl.searchParams.append('fields[]', 'id');
    listUrl.searchParams.append(
      'filter',
      JSON.stringify({ payment_voucher_id: { _eq: paymentVoucherId } }),
    );
    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!listResponse.ok) {
      await throwDirectusResponseError(
        listResponse,
        'Không thể đọc chứng từ liên quan cash/bank',
      );
    }
    const existing = (await listResponse.json()).data || [];
    if (existing.length > 0) {
      const deleteResponse = await fetch(
        `${this.directusUrl}/items/cash_bank_related_documents`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(existing.map((item: any) => item.id)),
        },
      );
      if (!deleteResponse.ok) {
        await throwDirectusResponseError(
          deleteResponse,
          'Không thể xoá chứng từ liên quan cũ',
        );
      }
    }

    for (const [index, doc] of (relatedDocuments || []).entries()) {
      const createResponse = await fetch(
        `${this.directusUrl}/items/cash_bank_related_documents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_voucher_id: paymentVoucherId,
            related_type: doc.related_type,
            related_id: doc.related_id,
            related_no: doc.related_no || null,
            related_date: doc.related_date || null,
            amount: doc.amount ?? null,
            note: doc.note || null,
            sort: index + 1,
          }),
        },
      );
      if (!createResponse.ok) {
        await throwDirectusResponseError(
          createResponse,
          'Không thể lưu chứng từ liên quan cash/bank',
        );
      }
    }
  }

  private async loadRelatedDocuments(paymentVoucherIds: string[]) {
    if (paymentVoucherIds.length === 0) return new Map<string, any[]>();
    const url = new URL('/items/cash_bank_related_documents', this.directusUrl);
    url.searchParams.append('limit', '-1');
    url.searchParams.append('sort[]', 'sort');
    for (const field of [
      'id',
      'payment_voucher_id',
      'related_type',
      'related_id',
      'related_no',
      'related_date',
      'amount',
      'note',
      'sort',
    ]) {
      url.searchParams.append('fields[]', field);
    }
    url.searchParams.append(
      'filter',
      JSON.stringify({ payment_voucher_id: { _in: paymentVoucherIds } }),
    );
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!response.ok) return new Map<string, any[]>();
    const rows = (await response.json()).data || [];
    const grouped = new Map<string, any[]>();
    for (const row of rows) {
      const key = typeof row.payment_voucher_id === 'object' ? row.payment_voucher_id.id : row.payment_voucher_id;
      grouped.set(key, [...(grouped.get(key) || []), row]);
    }
    return grouped;
  }

  private async attachRelatedDocuments<T extends any>(items: T[]): Promise<T[]> {
    const ids = items.map((item: any) => item.id).filter(Boolean);
    const grouped = await this.loadRelatedDocuments(ids);
    return items.map((item: any) => ({
      ...item,
      related_documents: grouped.get(item.id) || [],
    }));
  }

  async findCashBankTagPresets(query: PaymentVoucherQueryDto, userToken: string) {
    this.guard(userToken);
    const filter: any = { is_active: { _eq: true } };
    const andFilter: any[] = [filter];
    if (query.voucher_channel) {
      andFilter.push({ _or: [{ voucher_channel: { _eq: query.voucher_channel } }, { voucher_channel: { _null: true } }] });
    }
    if (query.voucher_direction) {
      andFilter.push({ _or: [{ voucher_direction: { _eq: query.voucher_direction } }, { voucher_direction: { _null: true } }] });
    }
    return this.adminListItems('cash_bank_tag_presets', {
      fields: [
        'id',
        'code',
        'label',
        'description',
        'voucher_channel',
        'voucher_direction',
        'debit_account_id',
        'credit_account_id',
        'sort',
      ],
      filter: andFilter.length > 1 ? { _and: andFilter } : filter,
      page: query.page,
      pageSize: query.pageSize || 100,
      sort: 'sort',
    });
  }

  private async findOpenAccountingPeriod(date: string): Promise<number | null> {
    const url = new URL('/items/accounting_periods', this.directusUrl);
    url.searchParams.append(
      'filter',
      JSON.stringify({
        _and: [
          { status: { _eq: 'open' } },
          { start_date: { _lte: date } },
          { end_date: { _gte: date } },
        ],
      }),
    );
    url.searchParams.append('limit', '1');
    url.searchParams.append('fields[]', 'id');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data?.[0]?.id ?? null;
  }

  private async findJournalEntryByReference(
    referenceType: string,
    referenceId: string,
  ): Promise<any | null> {
    const url = new URL('/items/journal_entries', this.directusUrl);
    url.searchParams.append(
      'filter',
      JSON.stringify({
        _and: [
          { reference_type: { _eq: referenceType } },
          { reference_id: { _eq: referenceId } },
        ],
      }),
    );
    url.searchParams.append('limit', '1');
    url.searchParams.append('fields[]', '*');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không thể kiểm tra bút toán nguồn');
    }
    const json = await res.json();
    return json.data?.[0] ?? null;
  }

  private async createPostedJournalEntryForVoucher(
    voucher: any,
    userId: string,
  ): Promise<any> {
    const existing = await this.findJournalEntryByReference(
      'payment_vouchers',
      voucher.id,
    );
    if (existing) return existing;

    const amount = Number(voucher.amount) || 0;
    if (!voucher.debit_account_id || !voucher.credit_account_id || amount <= 0) {
      throw new BadRequestException(
        'Không thể hạch toán: phiếu thiếu tài khoản nợ/có hoặc số tiền không hợp lệ',
      );
    }

    const date = voucher.posting_date || new Date().toISOString().slice(0, 10);
    const periodId = await this.findOpenAccountingPeriod(date);
    const voucherNo = `JNL-${voucher.voucher_no || voucher.id}`;

    const headerRes = await fetch(`${this.directusUrl}/items/journal_entries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voucher_no: voucherNo,
        date,
        period_id: periodId,
        description: voucher.description
          ? `Hạch toán phiếu ${voucher.voucher_no}: ${voucher.description}`
          : `Hạch toán phiếu ${voucher.voucher_no || voucher.id}`,
        status: 'posted',
        reference_type: 'payment_vouchers',
        reference_id: voucher.id,
        total_debit: amount,
        total_credit: amount,
        created_by: userId,
      }),
    });

    if (!headerRes.ok) {
      await throwDirectusResponseError(
        headerRes,
        'Không thể tạo bút toán từ phiếu đã hạch toán',
      );
    }
    const headerJson = await headerRes.json();
    const journalEntryId = headerJson.data?.id;
    if (!journalEntryId) {
      throw new InternalServerErrorException(
        'Tạo bút toán từ phiếu thất bại: không có ID',
      );
    }

    const linesPayload = [
      {
        journal_entry_id: journalEntryId,
        account_id:
          typeof voucher.debit_account_id === 'object'
            ? voucher.debit_account_id.id
            : voucher.debit_account_id,
        debit: amount,
        credit: 0,
        description: voucher.description || null,
        sort: 0,
      },
      {
        journal_entry_id: journalEntryId,
        account_id:
          typeof voucher.credit_account_id === 'object'
            ? voucher.credit_account_id.id
            : voucher.credit_account_id,
        debit: 0,
        credit: amount,
        description: voucher.description || null,
        sort: 1,
      },
    ];

    const linesRes = await fetch(`${this.directusUrl}/items/journal_entry_lines`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linesPayload),
    });

    if (!linesRes.ok) {
      await fetch(`${this.directusUrl}/items/journal_entries/${journalEntryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.adminToken}` },
      });
      await throwDirectusResponseError(
        linesRes,
        'Không thể tạo dòng bút toán từ phiếu đã hạch toán',
      );
    }

    const linesJson = await linesRes.json();
    return { ...headerJson.data, lines: linesJson.data || [] };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreatePaymentVouchersDto, userToken: string) {
    this.guard(userToken);
    this.validateChannel(dto);

    const counterpartyPayload = await this.buildCounterpartyPayload(dto);
    const client = this.getClient(userToken);

    try {
      const presetPayload = await this.resolveCashBankTagPreset(dto);
      const baseDto = this.stripCashBankTransientFields(dto);
      const payload = {
        ...baseDto,
        ...presetPayload,
        ...counterpartyPayload,
        status: dto.status || 'DRAFT',
      };
      const result = await (client as any).request(
        (createItem as any)(this.collection, payload),
      );
      await this.syncRelatedDocuments(result.id, dto.related_documents);
      const [withRelated] = await this.attachRelatedDocuments([result]);
      return { message: 'Tạo phiếu thu chi thành công', data: withRelated };
    } catch (error: any) {
      this.logger.error('Lỗi khi tạo phiếu thu chi', error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async findAll(query: PaymentVoucherQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      const page = query.page || 1;
      const pageSize = query.pageSize || 20;
      const sort = query.sort || '-created_at';
      const offset = (page - 1) * pageSize;

      const url = new URL(`/items/${this.collection}`, this.directusUrl);
      url.searchParams.append('limit', pageSize.toString());
      url.searchParams.append('offset', offset.toString());
      url.searchParams.append('meta', 'filter_count');
      url.searchParams.append('sort[]', sort);
      if (query.search) url.searchParams.append('search', query.search);

      const filterAnd: any[] = [];
      if (query.counterparty_source)
        filterAnd.push({
          counterparty_source: { _eq: query.counterparty_source },
        });
      if (query.voucher_channel)
        filterAnd.push({ voucher_channel: { _eq: query.voucher_channel } });
      if (query.voucher_type)
        filterAnd.push({ voucher_type: { _eq: query.voucher_type } });
      if (query.voucher_direction)
        filterAnd.push({ voucher_direction: { _eq: query.voucher_direction } });
      if (query.status) filterAnd.push({ status: { _eq: query.status } });
      if (query.counterparty_id)
        filterAnd.push({ counterparty_id: { _eq: query.counterparty_id } });
      if (query.employee_id)
        filterAnd.push({ employee_id: { _eq: query.employee_id } });
      if (query.posting_date_from)
        filterAnd.push({ posting_date: { _gte: query.posting_date_from } });
      if (query.posting_date_to)
        filterAnd.push({ posting_date: { _lte: query.posting_date_to } });
      if (query.amount !== undefined)
        filterAnd.push({ amount: { _eq: query.amount } });
      if (query.amount_min !== undefined)
        filterAnd.push({ amount: { _gte: query.amount_min } });
      if (query.amount_max !== undefined)
        filterAnd.push({ amount: { _lte: query.amount_max } });

      if (filterAnd.length > 0) {
        url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${userToken}` },
      });

      if (!response.ok) {
        await throwDirectusResponseError(
          response,
          'Không thể lấy danh sách phiếu thu chi',
        );
      }

      const result = await response.json();
      const total = result.meta?.filter_count || 0;
      const items = await this.attachRelatedDocuments(result.data || []);
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách phiếu thu chi', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách phiếu thu chi: ${error.message}`,
      );
    }
  }

  async findEmployeeOptions(query: PaymentVoucherQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      return await this.adminListItems('employees', {
        fields: ['id', 'full_name', 'phone'],
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        sort: 'full_name',
      });
    } catch (error: any) {
      this.logger.error(
        'Lỗi khi lấy danh sách nhân viên cho phiếu thu chi',
        error,
      );
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách nhân viên: ${error.message}`,
      );
    }
  }

  async findBusinessPartnerOptions(
    query: PaymentVoucherQueryDto,
    userToken: string,
  ) {
    this.guard(userToken);
    try {
      return await this.adminListItems('business_partners', {
        fields: ['id', 'display_name', 'name', 'tax_code', 'address', 'phone'],
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        sort: 'display_name',
      });
    } catch (error: any) {
      this.logger.error(
        'Lỗi khi lấy danh sách đối tác cho phiếu thu chi',
        error,
      );
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy danh sách đối tác: ${error.message}`,
      );
    }
  }

  async findBusinessPartnerBankAccountOptions(
    query: PaymentVoucherQueryDto,
    userToken: string,
  ) {
    this.guard(userToken);
    try {
      const filter = query.counterparty_id
        ? { business_partner_id: { _eq: query.counterparty_id } }
        : undefined;

      return await this.adminListItems('business_partner_bank_accounts', {
        fields: [
          'id',
          'business_partner_id',
          'bank_name',
          'account_number',
          'account_holder',
        ],
        filter,
        search: query.search,
        page: query.page,
        pageSize: query.pageSize,
        sort: 'bank_name',
      });
    } catch (error: any) {
      this.logger.error(
        'Lỗi khi lấy tài khoản ngân hàng đối tác cho phiếu thu chi',
        error,
      );
      rethrowHttpException(error);
      throw new InternalServerErrorException(
        `Không thể lấy tài khoản ngân hàng đối tác: ${error.message}`,
      );
    }
  }

  async getSummary(query: PaymentVoucherSummaryQueryDto, userToken: string) {
    this.guard(userToken);
    try {
      const headers = { Authorization: `Bearer ${userToken}` };

      const aggregateVouchers = async (
        extraFilter: any[],
      ): Promise<{ receipt: number; payment: number; count: number }> => {
        const url = new URL(`/items/${this.collection}`, this.directusUrl);
        url.searchParams.append('aggregate[sum]', 'amount');
        url.searchParams.append('aggregate[count]', 'id');
        url.searchParams.append('groupBy[]', 'voucher_direction');

        const baseFilter: any[] = [{ status: { _eq: 'POSTED' } }];
        if (query.voucher_channel)
          baseFilter.push({ voucher_channel: { _eq: query.voucher_channel } });
        if (query.cash_fund_id)
          baseFilter.push({ cash_fund_id: { _eq: query.cash_fund_id } });
        if (query.company_bank_account_id)
          baseFilter.push({
            company_bank_account_id: { _eq: query.company_bank_account_id },
          });
        if (query.counterparty_id)
          baseFilter.push({ counterparty_id: { _eq: query.counterparty_id } });

        url.searchParams.append(
          'filter',
          JSON.stringify({ _and: [...baseFilter, ...extraFilter] }),
        );

        const res = await fetch(url.toString(), { headers });
        if (!res.ok)
          throw new Error(`Directus aggregate error: ${res.statusText}`);
        const json = await res.json();
        const aggRows: any[] = json.data || [];

        let receipt = 0,
          payment = 0,
          count = 0;
        for (const row of aggRows) {
          const amt = Number(row.sum?.amount || 0);
          const cnt = Number(row.count?.id || 0);
          count += cnt;
          if (row.voucher_direction === 'IN') receipt += amt;
          if (row.voucher_direction === 'OUT') payment += amt;
        }
        return { receipt, payment, count };
      };

      let base_opening = 0;
      {
        const obUrl = new URL('/items/opening_balances', this.directusUrl);
        obUrl.searchParams.append('aggregate[sum]', 'debit_amount');
        obUrl.searchParams.append('aggregate[sum]', 'credit_amount');

        const obFilter: any[] = [];
        if (query.cash_fund_id)
          obFilter.push({ cash_fund_id: { _eq: query.cash_fund_id } });
        if (query.company_bank_account_id)
          obFilter.push({
            company_bank_account_id: { _eq: query.company_bank_account_id },
          });
        if (query.posting_date_from)
          obFilter.push({ balance_date: { _lt: query.posting_date_from } });
        if (obFilter.length > 0) {
          obUrl.searchParams.append(
            'filter',
            JSON.stringify({ _and: obFilter }),
          );
        }

        const obRes = await fetch(obUrl.toString(), { headers });
        if (obRes.ok) {
          const obJson = await obRes.json();
          const obRow = obJson.data?.[0];
          const debit = Number(obRow?.sum?.debit_amount || 0);
          const credit = Number(obRow?.sum?.credit_amount || 0);
          base_opening = debit - credit;
        }
      }

      let prior_receipt = 0,
        prior_payment = 0;
      if (query.posting_date_from) {
        const priorResult = await aggregateVouchers([
          { posting_date: { _lt: query.posting_date_from } },
        ]);
        prior_receipt = priorResult.receipt;
        prior_payment = priorResult.payment;
      }
      const opening_balance = base_opening + prior_receipt - prior_payment;

      const inRangeFilter: any[] = [];
      if (query.posting_date_from)
        inRangeFilter.push({ posting_date: { _gte: query.posting_date_from } });
      if (query.posting_date_to)
        inRangeFilter.push({ posting_date: { _lte: query.posting_date_to } });
      if (query.voucher_type)
        inRangeFilter.push({ voucher_type: { _eq: query.voucher_type } });
      if (query.document_date_from)
        inRangeFilter.push({
          document_date: { _gte: query.document_date_from },
        });
      if (query.document_date_to)
        inRangeFilter.push({ document_date: { _lte: query.document_date_to } });

      const {
        receipt: total_receipt,
        payment: total_payment,
        count: total_count,
      } = await aggregateVouchers(inRangeFilter);

      const closing_balance = opening_balance + total_receipt - total_payment;

      return {
        filters: query,
        opening_balance,
        total_receipt,
        total_payment,
        net: total_receipt - total_payment,
        closing_balance,
        total_count,
      };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy summary phiếu thu chi', error);
      throw new InternalServerErrorException(
        `Không thể lấy summary: ${error.message}`,
      );
    }
  }

  async findOne(id: string, userToken: string) {
    this.guard(userToken);
    const voucher = await this.loadVoucher(id, userToken);
    const [withRelated] = await this.attachRelatedDocuments([voucher]);
    return { message: 'Lấy thông tin phiếu thu chi thành công', data: withRelated };
  }

  async update(id: string, dto: UpdatePaymentVouchersDto, userToken: string) {
    this.guard(userToken);
    const current = await this.loadVoucher(id, userToken);

    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ có thể chỉnh sửa phiếu ở trạng thái DRAFT. Trạng thái hiện tại: ${current.status}`,
      );
    }

    // Validate channel nếu có thay đổi
    const channel = dto.voucher_channel ?? current.voucher_channel;
    const cashFundId = dto.cash_fund_id ?? current.cash_fund_id;
    const bankAccountId =
      dto.company_bank_account_id ?? current.company_bank_account_id;
    this.validateChannel({
      voucher_channel: channel,
      cash_fund_id: cashFundId,
      company_bank_account_id: bankAccountId,
    });

    // Re-build snapshot nếu counterparty_source hoặc các ID liên quan thay đổi
    let counterpartyPayload: Record<string, any> = {};
    const source = dto.counterparty_source ?? current.counterparty_source;
    if (dto.counterparty_source || dto.employee_id || dto.counterparty_id) {
      counterpartyPayload = await this.buildCounterpartyPayload({
        counterparty_source: source,
        employee_id: dto.employee_id ?? current.employee_id,
        counterparty_id: dto.counterparty_id ?? current.counterparty_id,
        beneficiary_bank_account_id:
          dto.beneficiary_bank_account_id ??
          current.beneficiary_bank_account_id,
        counterparty_name_snapshot: dto.counterparty_name_snapshot,
        counterparty_phone_snapshot: dto.counterparty_phone_snapshot,
        counterparty_identity_no_snapshot:
          dto.counterparty_identity_no_snapshot,
        counterparty_tax_code_snapshot: dto.counterparty_tax_code_snapshot,
        counterparty_address_snapshot: dto.counterparty_address_snapshot,
        beneficiary_bank_name_snapshot: dto.beneficiary_bank_name_snapshot,
        beneficiary_bank_account_snapshot:
          dto.beneficiary_bank_account_snapshot,
        beneficiary_account_holder_snapshot:
          dto.beneficiary_account_holder_snapshot,
      });
    }

    const client = this.getClient(userToken);
    try {
      const presetPayload = await this.resolveCashBankTagPreset({
        cash_bank_tag_preset_id: dto.cash_bank_tag_preset_id,
        cash_bank_tag_code: dto.cash_bank_tag_code,
        voucher_channel: channel,
        voucher_direction: dto.voucher_direction ?? current.voucher_direction,
      });
      const baseDto = this.stripCashBankTransientFields(dto);
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          ...baseDto,
          ...presetPayload,
          ...counterpartyPayload,
        }),
      );
      await this.syncRelatedDocuments(id, dto.related_documents);
      const [withRelated] = await this.attachRelatedDocuments([result]);
      return { message: 'Cập nhật phiếu thu chi thành công', data: withRelated };
    } catch (error: any) {
      this.logger.error(`Lỗi khi cập nhật phiếu thu chi ${id}`, error);
      const msg = error?.errors?.[0]?.message || error.message;
      throw new BadRequestException(`Lỗi: ${msg}`);
    }
  }

  async remove(id: string, userToken: string) {
    this.guard(userToken);
    const client = this.getClient(userToken);
    try {
      const attachments = await (client as any).request(
        (readItems as any)('payment_voucher_attachments', {
          filter: { payment_voucher_id: { _eq: id } },
          fields: ['id'],
        }),
      );
      const attachmentIds = attachments?.map((a: any) => a.id) || [];

      const logs = await (client as any).request(
        (readItems as any)('payment_voucher_approval_logs', {
          filter: { payment_voucher_id: { _eq: id } },
          fields: ['id'],
        }),
      );
      const logIds = logs?.map((l: any) => l.id) || [];

      if (attachmentIds.length > 0) {
        await (client as any).request(
          (deleteItems as any)('payment_voucher_attachments', attachmentIds),
        );
        this.logger.log(
          `Đã xóa ${attachmentIds.length} đính kèm của phiếu ${id}`,
        );
      }
      if (logIds.length > 0) {
        await (client as any).request(
          (deleteItems as any)('payment_voucher_approval_logs', logIds),
        );
        this.logger.log(
          `Đã xóa ${logIds.length} nhật ký duyệt của phiếu ${id}`,
        );
      }

      await (client as any).request((deleteItem as any)(this.collection, id));
      return {
        message: 'Xóa phiếu thu chi và các dữ liệu liên quan thành công',
      };
    } catch (error: any) {
      const status =
        error.status ||
        error?.response?.status ||
        error?.errors?.[0]?.extensions?.status;
      const code =
        error?.errors?.[0]?.extensions?.code || error?.errors?.[0]?.message;

      this.logger.error(
        `Lỗi khi xóa phiếu thu chi ${id} - Status: ${status} - Code: ${code}`,
        error,
      );

      if (
        status === 403 ||
        code === 'FORBIDDEN' ||
        error.message?.includes('FORBIDDEN')
      ) {
        throw new ForbiddenException(
          `Bạn không có quyền xóa phiếu này: ${code || error.message}`,
        );
      }

      throw new InternalServerErrorException(
        `Không thể xóa phiếu thu chi: ${error.message}`,
      );
    }
  }

  // ─── Status Transitions ───────────────────────────────────────────────────

  private async transitionStatus(
    id: string,
    targetStatus: string,
    extraPayload: Record<string, any>,
    logAction: string,
    logNote: string | undefined,
    userToken: string,
  ) {
    const current = await this.loadVoucher(id, userToken);
    const allowed = STATUS_TRANSITIONS[current.status] ?? [];

    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái từ ${current.status} sang ${targetStatus}`,
      );
    }

    const userId = await this.getCurrentUserId(userToken);
    const client = this.getClient(userToken);

    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          status: targetStatus,
          ...extraPayload,
        }),
      );

      await this.writeApprovalLog(
        id,
        logAction,
        logNote,
        userId,
        current.status,
        targetStatus,
        client,
      );

      return result;
    } catch (error: any) {
      this.logger.error(
        `Lỗi chuyển trạng thái phiếu ${id} sang ${targetStatus}`,
        error,
      );
      throwDirectusSdkError(error, 'Không thể chuyển trạng thái phiếu thu chi');
    }
  }

  async submitForApproval(id: string, userToken: string) {
    this.guard(userToken);
    const data = await this.transitionStatus(
      id,
      'PENDING_APPROVAL',
      {},
      'SUBMITTED',
      undefined,
      userToken,
    );
    return { message: 'Đã gửi phiếu chờ duyệt', data };
  }

  async approve(id: string, dto: VoucherApproveDto, userToken: string) {
    this.guard(userToken);
    const userId = await this.getCurrentUserId(userToken);
    const data = await this.transitionStatus(
      id,
      'APPROVED',
      { approved_by: userId, approved_at: new Date().toISOString() },
      'APPROVED',
      dto.note,
      userToken,
    );
    return { message: 'Phiếu đã được duyệt', data };
  }

  async reject(id: string, dto: VoucherRejectDto, userToken: string) {
    this.guard(userToken);
    const data = await this.transitionStatus(
      id,
      'REJECTED',
      {},
      'REJECTED',
      dto.note,
      userToken,
    );
    return { message: 'Phiếu đã bị từ chối', data };
  }

  async post(id: string, userToken: string) {
    this.guard(userToken);
    const userId = await this.getCurrentUserId(userToken);
    const data = await this.transitionStatus(
      id,
      'POSTED',
      { posted_at: new Date().toISOString() },
      'POSTED',
      undefined,
      userToken,
    );
    const journal_entry = await this.createPostedJournalEntryForVoucher(
      data,
      userId,
    );
    return { message: 'Phiếu đã được hạch toán', data, journal_entry };
  }

  async cancel(id: string, dto: VoucherCancelDto, userToken: string) {
    this.guard(userToken);
    const current = await this.loadVoucher(id, userToken);
    const cancellableFrom = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

    if (!cancellableFrom.includes(current.status)) {
      throw new BadRequestException(
        `Không thể hủy phiếu ở trạng thái ${current.status}`,
      );
    }

    const userId = await this.getCurrentUserId(userToken);
    const client = this.getClient(userToken);

    try {
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          status: 'CANCELLED',
          cancel_reason: dto.cancel_reason,
          cancelled_at: new Date().toISOString(),
        }),
      );

      await this.writeApprovalLog(
        id,
        'CANCELLED',
        dto.cancel_reason,
        userId,
        current.status,
        'CANCELLED',
        client,
      );

      return { message: 'Phiếu đã được hủy', data: result };
    } catch (error: any) {
      this.logger.error(`Lỗi hủy phiếu ${id}`, error);
      throwDirectusSdkError(error, 'Không thể hủy phiếu thu chi');
    }
  }
}
