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
  private readonly collection = 'gw_payment_vouchers';

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
    const url = new URL(`/items/gw_employees/${employeeId}`, this.directusUrl);
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
      `${this.directusUrl}/items/gw_business_partners/${counterpartyId}`,
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
      `${this.directusUrl}/items/gw_business_partner_bank_accounts/${bankAccountId}`,
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
        (createItem as any)('gw_payment_voucher_approval_logs', {
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

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(dto: CreatePaymentVouchersDto, userToken: string) {
    this.guard(userToken);
    this.validateChannel(dto);

    const counterpartyPayload = await this.buildCounterpartyPayload(dto);
    const client = this.getClient(userToken);

    try {
      const payload = {
        ...dto,
        ...counterpartyPayload,
        status: dto.status || 'DRAFT',
      };
      const result = await (client as any).request(
        (createItem as any)(this.collection, payload),
      );
      return { message: 'Tạo phiếu thu chi thành công', data: result };
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
      return {
        items: result.data || [],
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
      return await this.adminListItems('gw_employees', {
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
      return await this.adminListItems('gw_business_partners', {
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

      return await this.adminListItems('gw_business_partner_bank_accounts', {
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
        const obUrl = new URL('/items/gw_opening_balances', this.directusUrl);
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
    return { message: 'Lấy thông tin phiếu thu chi thành công', data: voucher };
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
      const result = await (client as any).request(
        (updateItem as any)(this.collection, id, {
          ...dto,
          ...counterpartyPayload,
        }),
      );
      return { message: 'Cập nhật phiếu thu chi thành công', data: result };
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
        (readItems as any)('gw_payment_voucher_attachments', {
          filter: { payment_voucher_id: { _eq: id } },
          fields: ['id'],
        }),
      );
      const attachmentIds = attachments?.map((a: any) => a.id) || [];

      const logs = await (client as any).request(
        (readItems as any)('gw_payment_voucher_approval_logs', {
          filter: { payment_voucher_id: { _eq: id } },
          fields: ['id'],
        }),
      );
      const logIds = logs?.map((l: any) => l.id) || [];

      if (attachmentIds.length > 0) {
        await (client as any).request(
          (deleteItems as any)('gw_payment_voucher_attachments', attachmentIds),
        );
        this.logger.log(
          `Đã xóa ${attachmentIds.length} đính kèm của phiếu ${id}`,
        );
      }
      if (logIds.length > 0) {
        await (client as any).request(
          (deleteItems as any)('gw_payment_voucher_approval_logs', logIds),
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
    const data = await this.transitionStatus(
      id,
      'POSTED',
      { posted_at: new Date().toISOString() },
      'POSTED',
      undefined,
      userToken,
    );
    return { message: 'Phiếu đã được hạch toán', data };
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
