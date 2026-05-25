import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDirectus, rest, staticToken } from '@directus/sdk';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { throwDirectusResponseError } from '../common/utils/directus-error.util';
import {
  BUSINESS_TYPE_RULES,
  CashflowBusinessType,
  CreateCashflowVoucherDto,
} from './dto/create-cashflow-voucher.dto';
import {
  CancelCashflowVoucherDto,
  PostCashflowVoucherDto,
  UpdateCashflowVoucherDto,
} from './dto/update-cashflow-voucher.dto';
import {
  AddAllocationDto,
  AddRelatedDocumentDto,
  CashflowVoucherQueryDto,
  CounterpartyLookupQueryDto,
} from './dto/cashflow-voucher-query.dto';

const LOCKED_AFTER_POSTED = new Set([
  'employee_id',
  'employee_code_snapshot',
  'employee_name_snapshot',
  'counterparty_id',
  'counterparty_code_snapshot',
  'counterparty_name_snapshot',
  'amount',
  'base_amount',
  'currency_code',
  'exchange_rate',
  'business_type',
  'flow_direction',
  'party_scope',
  'voucher_date',
  'voucher_family',
  'channel_type',
]);

@Injectable()
export class CashflowVouchersService {
  private readonly logger = new Logger(CashflowVouchersService.name);
  private readonly collection = 'erp_cashflow_vouchers';
  private readonly relatedCollection = 'erp_cashflow_voucher_related_documents';
  private readonly allocationCollection = 'erp_cashflow_allocations';

  constructor(
    @Inject(DIRECTUS_CLIENT)
    private readonly directus: ReturnType<typeof createDirectus>,
    private readonly configService: ConfigService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private get adminToken() {
    return this.configService.getOrThrow<string>('DIRECTUS_ADMIN_TOKEN');
  }

  private guard(token: string) {
    if (!token) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private userClient(token: string) {
    return createDirectus(this.directusUrl)
      .with(staticToken(token))
      .with(rest());
  }

  private async fetchMe(token: string): Promise<{ id: string }> {
    const res = await fetch(`${this.directusUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new UnauthorizedException('Không xác thực được user');
    }
    const body = await res.json();
    return body.data;
  }

  private async fetchItem(collection: string, id: string, fallback: string) {
    const res = await fetch(`${this.directusUrl}/items/${collection}/${id}`, {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (res.status === 404) throw new NotFoundException(fallback);
    if (!res.ok) await throwDirectusResponseError(res, fallback);
    const body = await res.json();
    return body.data;
  }

  private async findVoucher(id: string) {
    return this.fetchItem(this.collection, id, `Phiếu ${id} không tồn tại`);
  }

  private deriveFromBusinessType(businessType: string) {
    const rule = BUSINESS_TYPE_RULES[businessType as CashflowBusinessType];
    if (!rule) {
      throw new BadRequestException(
        `Loại nghiệp vụ không hợp lệ: ${businessType}`,
      );
    }
    return rule;
  }

  private validateParty(input: {
    party_scope: string;
    employee_id?: string;
    employee_name_snapshot?: string;
    counterparty_id?: string;
    counterparty_name_snapshot?: string;
  }) {
    if (input.party_scope === 'INTERNAL') {
      if (!input.employee_id && !input.employee_name_snapshot?.trim()) {
        throw new BadRequestException(
          'INTERNAL party_scope yêu cầu employee_id hoặc employee_name_snapshot',
        );
      }
      return;
    }

    if (input.party_scope === 'EXTERNAL') {
      if (!input.counterparty_id && !input.counterparty_name_snapshot?.trim()) {
        throw new BadRequestException(
          'EXTERNAL party_scope yêu cầu counterparty_id hoặc counterparty_name_snapshot',
        );
      }
      return;
    }

    throw new BadRequestException(
      `party_scope không hợp lệ: ${input.party_scope}`,
    );
  }

  private async fetchMoneySource(id: string) {
    const source = await this.fetchItem(
      'erp_money_sources',
      id,
      `Nguồn tiền ${id} không tồn tại`,
    );

    if (!source.is_active) {
      throw new BadRequestException(`Nguồn tiền ${id} đang ngưng hoạt động`);
    }

    if (!source.channel || !['CASH', 'BANK'].includes(source.channel)) {
      throw new BadRequestException(
        `Nguồn tiền ${id} chưa có channel hợp lệ CASH/BANK`,
      );
    }

    if (!source.branch_id) {
      throw new BadRequestException(`Nguồn tiền ${id} chưa gắn branch_id`);
    }

    return source;
  }

  private async resolveMoneySource(input: {
    channel_type: string;
    money_source_id?: string;
  }) {
    if (!input.money_source_id) {
      throw new BadRequestException('Phiếu yêu cầu money_source_id');
    }

    const source = await this.fetchMoneySource(input.money_source_id);
    if (source.channel !== input.channel_type) {
      throw new BadRequestException(
        `Nguồn tiền ${input.money_source_id} có channel ${source.channel}, không khớp với phiếu ${input.channel_type}`,
      );
    }

    return source;
  }

  private async fetchEmployeeSnapshot(employeeId: string) {
    // Throws NotFoundException if employee does not exist — enforces FK integrity at API layer
    const employee = await this.fetchItem(
      'erp_employees',
      employeeId,
      `Nhân viên ${employeeId} không tồn tại`,
    );
    return {
      employee_code_snapshot: employee.employee_code ?? null,
      employee_name_snapshot:
        employee.full_name ??
        [employee.first_name, employee.last_name].filter(Boolean).join(' ') ??
        null,
    };
  }

  private async fetchCounterpartySnapshot(counterpartyId: string) {
    // Throws NotFoundException if business_partner does not exist — enforces FK integrity at API layer
    const party = await this.fetchItem(
      'erp_business_partners',
      counterpartyId,
      `Đối tác ${counterpartyId} không tồn tại`,
    );
    return {
      counterparty_code_snapshot: party.code ?? null,
      counterparty_name_snapshot: party.display_name ?? party.name ?? null,
    };
  }

  private async generateVoucherNo(businessType: string) {
    const prefixMap: Record<string, string> = {
      CUSTOMER_RECEIPT: 'PT',
      SUPPLIER_PAYMENT: 'PC',
      DEPOSIT_RECEIVED: 'PT',
      DEPOSIT_REFUND: 'PC',
      EMPLOYEE_ADVANCE: 'PC',
      ADVANCE_REFUND: 'PT',
      DEBT_SETTLEMENT_RECEIPT: 'PT',
      DEBT_SETTLEMENT_PAYMENT: 'PC',
      INTERNAL_TRANSFER: 'PK',
      OTHER_RECEIPT: 'PT',
      OTHER_PAYMENT: 'PC',
    };
    const prefix = prefixMap[businessType] ?? 'PX';
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}?filter[voucher_no][_starts_with]=${prefix}${ymd}&limit=1&aggregate[count]=id`,
      { headers: { Authorization: `Bearer ${this.adminToken}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không lấy được sequence số phiếu');
    }
    const body = await res.json();
    const count = Number(body?.data?.[0]?.count?.id ?? 0);
    return `${prefix}${ymd}${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateCashflowVoucherDto, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const derived = this.deriveFromBusinessType(dto.business_type);

    this.validateParty(dto);
    const moneySource = await this.resolveMoneySource(dto);

    const employeeSnapshot = dto.employee_id
      ? await this.fetchEmployeeSnapshot(dto.employee_id)
      : { employee_code_snapshot: null, employee_name_snapshot: null };
    const counterpartySnapshot = dto.counterparty_id
      ? await this.fetchCounterpartySnapshot(dto.counterparty_id)
      : {
          counterparty_code_snapshot: null,
          counterparty_name_snapshot: null,
        };

    const exchangeRate = dto.exchange_rate ?? 1;
    const baseAmount = dto.base_amount ?? dto.amount * exchangeRate;
    const voucherNo =
      dto.voucher_no ?? (await this.generateVoucherNo(dto.business_type));

    const payload = {
      voucher_no: voucherNo,
      voucher_date: dto.voucher_date,
      branch_id: moneySource.branch_id,
      voucher_family: derived.voucher_family,
      channel_type: dto.channel_type,
      flow_direction: derived.flow_direction,
      business_type: dto.business_type,
      source_module: dto.source_module ?? null,
      source_document_type: dto.source_document_type ?? null,
      source_document_id: dto.source_document_id ?? null,
      party_scope: dto.party_scope,
      employee_id: dto.employee_id ?? null,
      employee_code_snapshot: employeeSnapshot.employee_code_snapshot,
      employee_name_snapshot:
        dto.employee_name_snapshot ?? employeeSnapshot.employee_name_snapshot,
      counterparty_id: dto.counterparty_id ?? null,
      counterparty_code_snapshot:
        counterpartySnapshot.counterparty_code_snapshot,
      counterparty_name_snapshot:
        dto.counterparty_name_snapshot ??
        counterpartySnapshot.counterparty_name_snapshot,
      currency_code: dto.currency_code ?? 'VND',
      exchange_rate: exchangeRate,
      amount: dto.amount,
      base_amount: baseAmount,
      money_source_id: dto.money_source_id,
      description: dto.description,
      note: dto.note ?? null,
      reason: dto.reason ?? null,
      reference_no: dto.reference_no ?? null,
      external_reference_no: dto.external_reference_no ?? null,
      status: 'DRAFT',
      created_by: me.id,
      allocation_status: 'UNALLOCATED',
      allocated_amount: 0,
      unallocated_amount: baseAmount,
      allocation_count: 0,
      related_document_count: 0,
      has_related_documents: false,
      is_active: true,
      data_version: 1,
    };

    const res = await fetch(`${this.directusUrl}/items/${this.collection}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không tạo được cashflow voucher');
    }
    const body = await res.json();

    await this.auditLogsService.logEvent({
      userToken: token,
      module: 'cashflow-vouchers',
      entityType: this.collection,
      entityId: body.data.id,
      entityNo: body.data.voucher_no,
      action: 'CREATE',
      eventGroup: 'VOUCHER_LIFECYCLE',
      afterPayload: body.data,
    });

    return { message: 'Tạo phiếu thành công', data: body.data };
  }

  async findAll(query: CashflowVoucherQueryDto, token: string) {
    this.guard(token);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const parts: string[] = [
      `limit=${pageSize}`,
      `offset=${offset}`,
      `sort=${encodeURIComponent(query.sort ?? '-voucher_date,-created_at')}`,
      'meta=filter_count',
    ];

    if (query.status)
      parts.push(`filter[status][_eq]=${encodeURIComponent(query.status)}`);
    if (query.channel_type)
      parts.push(
        `filter[channel_type][_eq]=${encodeURIComponent(query.channel_type)}`,
      );
    if (query.flow_direction)
      parts.push(
        `filter[flow_direction][_eq]=${encodeURIComponent(query.flow_direction)}`,
      );
    if (query.business_type)
      parts.push(
        `filter[business_type][_eq]=${encodeURIComponent(query.business_type)}`,
      );
    if (query.party_scope)
      parts.push(
        `filter[party_scope][_eq]=${encodeURIComponent(query.party_scope)}`,
      );
    if (query.branch_id)
      parts.push(`filter[branch_id][_eq]=${query.branch_id}`);
    parts.push('filter[is_active][_eq]=true');
    if (query.date_from)
      parts.push(`filter[voucher_date][_gte]=${query.date_from}`);
    if (query.date_to)
      parts.push(`filter[voucher_date][_lte]=${query.date_to}`);
    if (query.search) parts.push(`search=${encodeURIComponent(query.search)}`);

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}?${parts.join('&')}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(
        res,
        'Không lấy được danh sách cashflow vouchers',
      );
    }
    const body = await res.json();
    return {
      items: body.data ?? [],
      total: body.meta?.filter_count ?? 0,
      page,
      pageSize,
    };
  }

  async findOne(id: string, token: string) {
    this.guard(token);
    const voucher = await this.findVoucher(id);
    return { data: voucher };
  }

  async update(id: string, dto: UpdateCashflowVoucherDto, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    if (voucher.status === 'CANCELLED') {
      throw new ForbiddenException('Không thể sửa phiếu đã CANCELLED');
    }

    const payload: Record<string, unknown> = {};

    if (voucher.status === 'POSTED') {
      const lockedAttempts = Object.keys(dto).filter((key) =>
        LOCKED_AFTER_POSTED.has(key),
      );
      if (lockedAttempts.length > 0) {
        throw new ForbiddenException(
          `Không thể sửa field khóa sổ sau POSTED: ${lockedAttempts.join(', ')}`,
        );
      }

      if (dto.description !== undefined) payload.description = dto.description;
      if (dto.note !== undefined) payload.note = dto.note;
      if (dto.reason !== undefined) payload.reason = dto.reason;
    } else {
      const allowed = [
        'voucher_date',
        'employee_id',
        'employee_name_snapshot',
        'counterparty_id',
        'counterparty_name_snapshot',
        'amount',
        'base_amount',
        'currency_code',
        'exchange_rate',
        'party_scope',
        'description',
        'note',
        'reason',
        'reference_no',
        'external_reference_no',
        'money_source_id',
      ] as const;

      for (const key of allowed) {
        if (dto[key] !== undefined) {
          payload[key] = dto[key];
        }
      }

      if (
        payload.party_scope ||
        payload.employee_id ||
        payload.employee_name_snapshot ||
        payload.counterparty_id ||
        payload.counterparty_name_snapshot
      ) {
        this.validateParty({
          party_scope: (payload.party_scope as string) ?? voucher.party_scope,
          employee_id: (payload.employee_id as string) ?? voucher.employee_id,
          employee_name_snapshot:
            (payload.employee_name_snapshot as string) ??
            voucher.employee_name_snapshot,
          counterparty_id:
            (payload.counterparty_id as string) ?? voucher.counterparty_id,
          counterparty_name_snapshot:
            (payload.counterparty_name_snapshot as string) ??
            voucher.counterparty_name_snapshot,
        });
      }

      const resolvedMoneySource = await this.resolveMoneySource({
        channel_type: voucher.channel_type,
        money_source_id:
          (payload.money_source_id as string) ?? voucher.money_source_id,
      });
      payload.money_source_id = resolvedMoneySource.id;
      payload.branch_id = resolvedMoneySource.branch_id;

      if (
        typeof payload.employee_id === 'string' &&
        payload.employee_id &&
        payload.employee_id !== voucher.employee_id
      ) {
        Object.assign(
          payload,
          await this.fetchEmployeeSnapshot(payload.employee_id),
        );
      }
      if (
        typeof payload.counterparty_id === 'string' &&
        payload.counterparty_id &&
        payload.counterparty_id !== voucher.counterparty_id
      ) {
        Object.assign(
          payload,
          await this.fetchCounterpartySnapshot(payload.counterparty_id),
        );
      }

      const amount = Number(payload.amount ?? voucher.amount);
      const exchangeRate = Number(
        payload.exchange_rate ?? voucher.exchange_rate ?? 1,
      );
      payload.base_amount = Number(
        payload.base_amount ?? amount * exchangeRate,
      );
      payload.unallocated_amount =
        Number(payload.base_amount) - Number(voucher.allocated_amount ?? 0);
    }

    if (Object.keys(payload).length === 0) {
      return { message: 'Không có thay đổi', data: voucher };
    }

    payload.updated_by = me.id;
    payload.updated_at = new Date().toISOString();

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(
        res,
        'Không cập nhật được cashflow voucher',
      );
    }
    const body = await res.json();

    await this.auditLogsService.logEvent({
      userToken: token,
      module: 'cashflow-vouchers',
      entityType: this.collection,
      entityId: id,
      entityNo: voucher.voucher_no,
      action: 'UPDATE',
      eventGroup: 'VOUCHER_LIFECYCLE',
      beforePayload: voucher,
      afterPayload: body.data,
    });

    return { message: 'Cập nhật phiếu thành công', data: body.data };
  }

  async remove(id: string, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    if (voucher.status !== 'DRAFT') {
      throw new ForbiddenException(
        `Chỉ phiếu DRAFT mới được xóa mềm. Trạng thái hiện tại: ${voucher.status}`,
      );
    }

    const payload = {
      is_active: false,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(
        res,
        'Không xóa mềm được cashflow voucher',
      );
    }
    const body = await res.json();

    await this.auditLogsService.logEvent({
      userToken: token,
      module: 'cashflow-vouchers',
      entityType: this.collection,
      entityId: id,
      entityNo: voucher.voucher_no,
      action: 'SOFT_DELETE',
      eventGroup: 'VOUCHER_LIFECYCLE',
      beforePayload: voucher,
      afterPayload: body.data,
    });

    return { message: 'Xóa mềm phiếu thành công', data: body.data };
  }

  async cancel(id: string, dto: CancelCashflowVoucherDto, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    if (voucher.status !== 'POSTED') {
      throw new BadRequestException(
        `Chỉ phiếu POSTED mới được CANCELLED. Trạng thái hiện tại: ${voucher.status}`,
      );
    }

    const payload = {
      status: 'CANCELLED',
      cancelled_by: me.id,
      cancelled_at: new Date().toISOString(),
      cancel_reason: dto.cancel_reason,
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không hủy được cashflow voucher');
    }
    const body = await res.json();

    await this.auditLogsService.logEvent({
      userToken: token,
      module: 'cashflow-vouchers',
      entityType: this.collection,
      entityId: id,
      entityNo: voucher.voucher_no,
      action: 'CANCEL',
      eventGroup: 'VOUCHER_LIFECYCLE',
      beforePayload: voucher,
      afterPayload: body.data,
      reason: dto.cancel_reason,
    });

    return { message: 'Hủy phiếu thành công', data: body.data };
  }

  async postVoucher(id: string, dto: PostCashflowVoucherDto, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    if (voucher.status !== 'DRAFT') {
      throw new BadRequestException(
        `Chỉ phiếu DRAFT mới được POSTED. Trạng thái hiện tại: ${voucher.status}`,
      );
    }

    let journalEntryId: number | null = null;
    let journalEntryNo: string | null = null;

    if (dto.journal_entry) {
      const jeRes = await fetch(
        `${this.directusUrl}/items/erp_journal_entries`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entry_date: voucher.voucher_date,
            description: `${voucher.voucher_no} - ${voucher.description}`,
            status: 'POSTED',
            source_module: 'cashflow-vouchers',
            source_document_type: this.collection,
            source_document_id: id,
            created_by: me.id,
          }),
        },
      );
      if (!jeRes.ok) {
        await throwDirectusResponseError(jeRes, 'Không tạo được journal entry');
      }
      const jeBody = await jeRes.json();
      journalEntryId = jeBody.data?.id ?? null;
      journalEntryNo = jeBody.data?.entry_no ?? null;
    }

    const payload: Record<string, unknown> = {
      status: 'POSTED',
      posted_by: me.id,
      posted_at: new Date().toISOString(),
      updated_by: me.id,
      updated_at: new Date().toISOString(),
    };
    if (journalEntryId) payload.journal_entry_id = journalEntryId;
    if (journalEntryNo) payload.journal_entry_no_snapshot = journalEntryNo;

    const res = await fetch(
      `${this.directusUrl}/items/${this.collection}/${id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(
        res,
        'Không ghi sổ được cashflow voucher',
      );
    }
    const body = await res.json();

    await this.auditLogsService.logEvent({
      userToken: token,
      module: 'cashflow-vouchers',
      entityType: this.collection,
      entityId: id,
      entityNo: voucher.voucher_no,
      action: 'POST',
      eventGroup: 'VOUCHER_LIFECYCLE',
      beforePayload: voucher,
      afterPayload: body.data,
      note: journalEntryId ? `journal_entry_id=${journalEntryId}` : null,
    });

    return { message: 'Ghi sổ phiếu thành công', data: body.data };
  }

  async getTimeline(id: string, token: string) {
    this.guard(token);
    await this.findVoucher(id);

    const res = await fetch(
      `${this.directusUrl}/items/audit_logs?filter[entity_type][_eq]=${this.collection}&filter[entity_id][_eq]=${id}&sort=-created_at&limit=200`,
      { headers: { Authorization: `Bearer ${this.adminToken}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không lấy được timeline');
    }
    const body = await res.json();
    return { data: body.data ?? [] };
  }

  async getRelatedDocuments(id: string, token: string) {
    this.guard(token);
    await this.findVoucher(id);

    const res = await fetch(
      `${this.directusUrl}/items/${this.relatedCollection}?filter[cashflow_voucher_id][_eq]=${id}&sort=sort_order`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không lấy được related documents');
    }
    const body = await res.json();
    return { data: body.data ?? [] };
  }

  async addRelatedDocument(
    id: string,
    dto: AddRelatedDocumentDto,
    token: string,
  ) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    const res = await fetch(
      `${this.directusUrl}/items/${this.relatedCollection}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cashflow_voucher_id: id,
          related_document_type: dto.related_document_type,
          related_document_id: dto.related_document_id,
          related_document_no_snapshot:
            dto.related_document_no_snapshot ?? null,
          reference_amount: dto.reference_amount ?? null,
          note: dto.note ?? null,
          sort_order: 0,
          created_by: me.id,
        }),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không thêm được related document');
    }
    const body = await res.json();

    await fetch(`${this.directusUrl}/items/${this.collection}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        related_document_count: Number(voucher.related_document_count ?? 0) + 1,
        has_related_documents: true,
      }),
    });

    return { message: 'Thêm chứng từ liên quan thành công', data: body.data };
  }

  async removeRelatedDocument(id: string, relatedId: string, token: string) {
    this.guard(token);
    const voucher = await this.findVoucher(id);

    const res = await fetch(
      `${this.directusUrl}/items/${this.relatedCollection}/${relatedId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.adminToken}` },
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không xóa được related document');
    }

    const newCount = Math.max(
      0,
      Number(voucher.related_document_count ?? 0) - 1,
    );
    await fetch(`${this.directusUrl}/items/${this.collection}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        related_document_count: newCount,
        has_related_documents: newCount > 0,
      }),
    });

    return { message: 'Xóa chứng từ liên quan thành công' };
  }

  async getAllocations(id: string, token: string) {
    this.guard(token);
    await this.findVoucher(id);

    const res = await fetch(
      `${this.directusUrl}/items/${this.allocationCollection}?filter[cashflow_voucher_id][_eq]=${id}&filter[status][_eq]=ACTIVE&sort=-created_at`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không lấy được allocations');
    }
    const body = await res.json();
    return { data: body.data ?? [] };
  }

  async addAllocation(id: string, dto: AddAllocationDto, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);

    if (voucher.status !== 'POSTED') {
      throw new BadRequestException('Chỉ phiếu POSTED mới được phân bổ');
    }

    const available = Number(voucher.unallocated_amount ?? 0);
    if (dto.allocated_amount > available) {
      throw new BadRequestException(
        `Phân bổ vượt số chưa phân bổ. Còn lại: ${available}, yêu cầu: ${dto.allocated_amount}`,
      );
    }

    const exchangeRate = dto.exchange_rate ?? 1;
    const baseAllocatedAmount = dto.allocated_amount * exchangeRate;

    const res = await fetch(
      `${this.directusUrl}/items/${this.allocationCollection}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cashflow_voucher_id: id,
          target_document_type: dto.target_document_type,
          target_document_id: dto.target_document_id,
          target_document_no_snapshot: dto.target_document_no_snapshot ?? null,
          allocation_type: dto.allocation_type,
          allocated_amount: dto.allocated_amount,
          currency_code: dto.currency_code ?? voucher.currency_code ?? 'VND',
          exchange_rate: exchangeRate,
          base_allocated_amount: baseAllocatedAmount,
          status: 'ACTIVE',
          reason: dto.reason ?? null,
          created_by: me.id,
          source_open_before: available,
          source_open_after: available - dto.allocated_amount,
        }),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không thêm được allocation');
    }
    const body = await res.json();

    const newAllocated =
      Number(voucher.allocated_amount ?? 0) + dto.allocated_amount;
    const newUnallocated = Number(voucher.base_amount ?? 0) - newAllocated;
    await fetch(`${this.directusUrl}/items/${this.collection}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allocated_amount: newAllocated,
        unallocated_amount: Math.max(0, newUnallocated),
        allocation_count: Number(voucher.allocation_count ?? 0) + 1,
        allocation_status:
          newUnallocated <= 0
            ? 'FULL'
            : newAllocated > 0
              ? 'PARTIAL'
              : 'UNALLOCATED',
      }),
    });

    return { message: 'Phân bổ thành công', data: body.data };
  }

  async removeAllocation(id: string, allocationId: string, token: string) {
    this.guard(token);
    const me = await this.fetchMe(token);
    const voucher = await this.findVoucher(id);
    const allocation = await this.fetchItem(
      this.allocationCollection,
      allocationId,
      `Allocation ${allocationId} không tồn tại`,
    );

    if (allocation.cashflow_voucher_id !== id) {
      throw new ForbiddenException('Allocation không thuộc phiếu này');
    }

    const res = await fetch(
      `${this.directusUrl}/items/${this.allocationCollection}/${allocationId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'REVERSED',
          allocation_updated_by: me.id,
          allocation_updated_at: new Date().toISOString(),
          allocation_update_reason: 'Gỡ phân bổ',
        }),
      },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không gỡ được allocation');
    }

    const newAllocated = Math.max(
      0,
      Number(voucher.allocated_amount ?? 0) -
        Number(allocation.allocated_amount ?? 0),
    );
    const newUnallocated = Number(voucher.base_amount ?? 0) - newAllocated;
    await fetch(`${this.directusUrl}/items/${this.collection}/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        allocated_amount: newAllocated,
        unallocated_amount: Math.max(0, newUnallocated),
        allocation_count: Math.max(
          0,
          Number(voucher.allocation_count ?? 0) - 1,
        ),
        allocation_status:
          newUnallocated <= 0
            ? 'FULL'
            : newAllocated > 0
              ? 'PARTIAL'
              : 'UNALLOCATED',
      }),
    });

    return { message: 'Gỡ phân bổ thành công' };
  }

  async findParties(query: CounterpartyLookupQueryDto, token: string) {
    this.guard(token);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const scope = (query.scope ?? '').toUpperCase();

    if (scope === 'INTERNAL') {
      const res = await fetch(
        `${this.directusUrl}/items/erp_employees?filter[is_active][_eq]=true&limit=${pageSize}&offset=${offset}&fields=id,employee_code,first_name,last_name,full_name,branch_id${
          query.query ? `&search=${encodeURIComponent(query.query)}` : ''
        }`,
        { headers: { Authorization: `Bearer ${this.adminToken}` } },
      );
      if (!res.ok) {
        await throwDirectusResponseError(res, 'Không lookup được employees');
      }
      const body = await res.json();
      return {
        scope: 'INTERNAL',
        data: (body.data ?? []).map((item: any) => ({
          id: item.id,
          scope: 'INTERNAL',
          code: item.employee_code ?? null,
          display_name:
            item.full_name ??
            [item.first_name, item.last_name].filter(Boolean).join(' ') ??
            null,
          branch_id: item.branch_id ?? null,
        })),
      };
    }

    const res = await fetch(
      `${this.directusUrl}/items/erp_business_partners?filter[is_active][_eq]=true&limit=${pageSize}&offset=${offset}&fields=id,code,name,display_name,tax_code${
        query.query ? `&search=${encodeURIComponent(query.query)}` : ''
      }`,
      { headers: { Authorization: `Bearer ${this.adminToken}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(
        res,
        'Không lookup được business partners',
      );
    }
    const body = await res.json();
    return {
      scope: 'EXTERNAL',
      data: (body.data ?? []).map((item: any) => ({
        id: item.id,
        scope: 'EXTERNAL',
        code: item.code ?? null,
        display_name: item.display_name ?? item.name ?? null,
        tax_code: item.tax_code ?? null,
        branch_id: null,
      })),
    };
  }

  async findPartyById(
    id: string,
    query: CounterpartyLookupQueryDto,
    token: string,
  ) {
    this.guard(token);
    const scope = (query.scope ?? '').toUpperCase();

    if (scope === 'INTERNAL') {
      const item = await this.fetchItem(
        'erp_employees',
        id,
        `Nhân viên ${id} không tồn tại`,
      );

      return {
        data: {
          id: item.id,
          scope: 'INTERNAL',
          code: item.employee_code ?? null,
          display_name:
            item.full_name ??
            [item.first_name, item.last_name].filter(Boolean).join(' ') ??
            null,
          branch_id: item.branch_id ?? null,
          source_type: 'erp_employees',
          source_id: item.id,
        },
      };
    }

    const item = await this.fetchItem(
      'erp_business_partners',
      id,
      `Đối tác ${id} không tồn tại`,
    );

    return {
      data: {
        id: item.id,
        scope: 'EXTERNAL',
        code: item.code ?? null,
        display_name: item.display_name ?? item.name ?? null,
        tax_code: item.tax_code ?? null,
        branch_id: null,
        source_type: 'erp_business_partners',
        source_id: item.id,
      },
    };
  }

  async findMoneySources(token: string) {
    this.guard(token);
    const res = await fetch(
      `${this.directusUrl}/items/erp_money_sources?filter[is_active][_eq]=true&limit=-1&sort=code&fields=id,code,name,branch_id,accounting_account_id,channel,currency_code,legacy_cash_fund_id,legacy_bank_account_id`,
      { headers: { Authorization: `Bearer ${this.adminToken}` } },
    );
    if (!res.ok) {
      await throwDirectusResponseError(res, 'Không lookup được nguồn tiền');
    }
    const body = await res.json();
    return {
      data: (body.data ?? []).map((item: any) => ({
        id: item.id,
        code: item.code ?? null,
        name: item.name ?? null,
        label: [item.code, item.name].filter(Boolean).join(' - '),
        branch_id: item.branch_id ?? null,
        accounting_account_id: item.accounting_account_id ?? null,
        channel: item.channel,
        currency_code: item.currency_code ?? 'VND',
        legacy_cash_fund_id: item.legacy_cash_fund_id ?? null,
        legacy_bank_account_id: item.legacy_bank_account_id ?? null,
      })),
    };
  }
}
