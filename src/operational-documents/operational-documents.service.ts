import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateDocumentPaymentLinkDto,
  CreateOperatingExpenseDto,
  CreatePurchaseOrderDto,
  CreateSalesServiceOrderDto,
  OperationalLineDto,
  OperationalQueryDto,
} from './dto/operational-document.dto';

const DOCUMENT_COLLECTIONS = [
  'sales_service_orders',
  'purchase_orders',
  'operating_expenses',
] as const;

const PAYABLE_COLLECTIONS = ['purchase_orders', 'operating_expenses'] as const;

type DocumentCollection = (typeof DOCUMENT_COLLECTIONS)[number];
type PayableCollection = (typeof PAYABLE_COLLECTIONS)[number];

interface RecurringCandidate {
  id: string;
  purchase_no?: string;
  expense_no?: string;
  branch_id?: string | null;
  supplier_id?: string | null;
  supplier_name_snapshot?: string | null;
  expense_category?: string | null;
  title?: string | null;
  document_date?: string | null;
  due_date?: string | null;
  invoice_status?: string | null;
  status?: string | null;
  total_amount?: number | string | null;
  recurrence_type?: string | null;
  recurrence_interval?: number | string | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  next_due_date?: string | null;
  auto_generate_next?: boolean | null;
  parent_recurring_id?: string | null;
  notes?: string | null;
}

@Injectable()
export class OperationalDocumentsService {
  private readonly logger = new Logger(OperationalDocumentsService.name);

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
    init: RequestInit = {},
    token = this.adminToken,
  ): Promise<T> {
    const res = await fetch(`${this.directusUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`Directus ${path} failed: ${res.status} ${text}`);
      throw new BadRequestException(
        text || `Directus request failed ${res.status}`,
      );
    }
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  private buildListUrl(collection: string, query: OperationalQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const url = new URL(`/items/${collection}`, this.directusUrl);
    url.searchParams.append('limit', String(pageSize));
    url.searchParams.append('offset', String(offset));
    url.searchParams.append('meta', 'filter_count');
    url.searchParams.append('sort[]', query.sort || '-document_date');
    url.searchParams.append('fields[]', '*');
    if (query.search) url.searchParams.append('search', query.search);
    if (query.branch_id)
      url.searchParams.append('filter[branch_id][_eq]', query.branch_id);
    if (query.status)
      url.searchParams.append('filter[status][_eq]', query.status);
    if (query.payment_status)
      url.searchParams.append(
        'filter[payment_status][_eq]',
        query.payment_status,
      );
    if (query.invoice_status)
      url.searchParams.append(
        'filter[invoice_status][_eq]',
        query.invoice_status,
      );
    if (query.source_system && collection === 'sales_service_orders') {
      url.searchParams.append(
        'filter[source_system][_eq]',
        query.source_system,
      );
    }
    return url;
  }

  async list(
    collection: string,
    query: OperationalQueryDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const url = this.buildListUrl(collection, query);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) throw new BadRequestException(await res.text());
    const result = await res.json();
    const total = result.meta?.filter_count || 0;
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return {
      items: result.data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(collection: string, id: string, userToken: string) {
    this.guard(userToken);
    const data = await this.loadDocument(
      collection as DocumentCollection,
      id,
      true,
    );
    if (!data) throw new NotFoundException('Không tìm thấy chứng từ');
    return { data };
  }

  private lineCollection(collection: string) {
    if (collection === 'sales_service_orders')
      return 'sales_service_order_lines';
    if (collection === 'purchase_orders') return 'purchase_order_lines';
    if (collection === 'operating_expenses') return 'operating_expense_lines';
    throw new BadRequestException('Loại chứng từ không hợp lệ');
  }

  private lineFk(collection: string) {
    if (collection === 'sales_service_orders') return 'order_id';
    if (collection === 'purchase_orders') return 'purchase_order_id';
    if (collection === 'operating_expenses') return 'operating_expense_id';
    throw new BadRequestException('Loại chứng từ không hợp lệ');
  }

  private async findLines(collection: string, id: string) {
    const lineCollection = this.lineCollection(collection);
    const fk = this.lineFk(collection);
    const path = `/items/${lineCollection}?filter[${fk}][_eq]=${id}&sort[]=line_no&fields[]=*`;
    const { data } = await this.request<{ data: any[] }>(path);
    return data || [];
  }

  private async findPaymentLinks(documentType: DocumentCollection, id: string) {
    const path = `/items/document_payment_links?filter[document_type][_eq]=${documentType}&filter[document_id][_eq]=${id}&sort[]=-applied_date&fields[]=*`;
    const { data } = await this.request<{ data: any[] }>(path);
    return data || [];
  }

  private sumLines(lines: OperationalLineDto[] = []) {
    return lines.reduce((sum, line) => {
      const amount = Number(
        line.amount ?? Number(line.qty || 0) * Number(line.unit_price || 0),
      );
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  private normalizeDate(value?: string | null) {
    if (!value) return undefined;
    return String(value).slice(0, 10);
  }

  private shiftDate(
    dateText: string,
    recurrenceType: string,
    recurrenceInterval = 1,
  ) {
    const base = new Date(`${dateText}T00:00:00.000Z`);
    const next = new Date(base);
    const step = Math.max(1, Number(recurrenceInterval || 1));
    switch (recurrenceType) {
      case 'MONTHLY':
        next.setUTCMonth(next.getUTCMonth() + step);
        break;
      case 'QUARTERLY':
        next.setUTCMonth(next.getUTCMonth() + step * 3);
        break;
      case 'YEARLY':
        next.setUTCFullYear(next.getUTCFullYear() + step);
        break;
      default:
        next.setUTCDate(next.getUTCDate() + step);
        break;
    }
    return this.normalizeDate(next.toISOString())!;
  }

  private recurringCollections() {
    return PAYABLE_COLLECTIONS;
  }

  async loadDocument(
    collection: DocumentCollection,
    id: string,
    includeRelations = false,
  ) {
    const { data } = await this.request<{ data: any }>(
      `/items/${collection}/${id}?fields[]=*`,
    );
    if (!data) return null;
    if (!includeRelations) return data;
    const lines = await this.findLines(collection, id);
    const payments = await this.findPaymentLinks(collection, id);
    return { ...data, lines, payments };
  }

  private async createWithLines(
    collection: string,
    dto: any,
    userToken: string,
  ) {
    this.guard(userToken);
    const lines = dto.lines || [];
    const { lines: _ignored, ...documentPayload } = dto;
    const total = documentPayload.total_amount ?? this.sumLines(lines);
    const generatedNo = this.generateNo(collection, documentPayload);
    const payload = {
      ...documentPayload,
      [this.documentNoField(collection)]:
        documentPayload[this.documentNoField(collection)] || generatedNo,
      total_amount: total,
    };
    if (collection === 'sales_service_orders') {
      payload.source_system = payload.source_system || 'ERP';
      payload.customer_name_snapshot = payload.customer_name_snapshot || '';
    }
    if (collection === 'purchase_orders') {
      payload.supplier_name_snapshot = payload.supplier_name_snapshot || '';
    }
    if (collection === 'operating_expenses') {
      payload.supplier_name_snapshot = payload.supplier_name_snapshot || '';
      payload.title = payload.title || payload.expense_no || generatedNo;
    }
    const { data } = await this.request<{ data: any }>(`/items/${collection}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await this.replaceLines(collection, data.id, lines);
    return this.findOne(collection, data.id, userToken);
  }

  private documentNoField(collection: string) {
    if (collection === 'sales_service_orders') return 'order_no';
    if (collection === 'purchase_orders') return 'purchase_no';
    if (collection === 'operating_expenses') return 'expense_no';
    throw new BadRequestException('Loại chứng từ không hợp lệ');
  }

  private generateNo(collection: string, payload: any) {
    const prefix =
      collection === 'sales_service_orders'
        ? payload.source_system === 'KGARA'
          ? 'KG'
          : payload.source_system === 'VINFAST_DMS'
            ? 'DMS'
            : 'SSO'
        : collection === 'purchase_orders'
          ? 'PO'
          : 'OE';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}-${date}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async replaceLines(
    collection: string,
    id: string,
    lines: OperationalLineDto[],
  ) {
    const lineCollection = this.lineCollection(collection);
    const fk = this.lineFk(collection);
    const current = await this.findLines(collection, id);
    for (const row of current) {
      await this.request(`/items/${lineCollection}/${row.id}`, {
        method: 'DELETE',
      });
    }
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const qty = Number(line.qty ?? 1);
      const unitPrice = Number(line.unit_price ?? 0);
      const amount = Number(line.amount ?? qty * unitPrice);
      await this.request(`/items/${lineCollection}`, {
        method: 'POST',
        body: JSON.stringify({
          ...line,
          [fk]: id,
          line_no: line.line_no || i + 1,
          qty,
          unit_price: unitPrice,
          amount,
          item_name: line.item_name || line.description || '',
        }),
      });
    }
  }

  createSales(dto: CreateSalesServiceOrderDto, userToken: string) {
    return this.createWithLines('sales_service_orders', dto, userToken);
  }

  createPurchase(dto: CreatePurchaseOrderDto, userToken: string) {
    return this.createWithLines('purchase_orders', dto, userToken);
  }

  createExpense(dto: CreateOperatingExpenseDto, userToken: string) {
    return this.createWithLines('operating_expenses', dto, userToken);
  }

  async updateDocument(
    collection: string,
    id: string,
    dto: any,
    userToken: string,
  ) {
    this.guard(userToken);
    const { lines, ...documentPayload } = dto;
    await this.request(`/items/${collection}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(documentPayload),
    });
    if (Array.isArray(lines)) await this.replaceLines(collection, id, lines);
    return this.findOne(collection, id, userToken);
  }

  async listPaymentLinks(
    documentType: DocumentCollection,
    documentId: string,
    userToken: string,
  ) {
    this.guard(userToken);
    return {
      items: await this.findPaymentLinks(documentType, documentId),
    };
  }

  async deletePaymentLink(
    documentType: DocumentCollection,
    documentId: string,
    linkId: string,
    userToken: string,
  ) {
    this.guard(userToken);
    const { data } = await this.request<{ data: any }>(
      `/items/document_payment_links/${linkId}?fields[]=id&fields[]=document_type&fields[]=document_id`,
    );
    if (!data)
      throw new NotFoundException('Không tìm thấy liên kết thanh toán');
    if (
      data.document_type !== documentType ||
      data.document_id !== documentId
    ) {
      throw new BadRequestException('Liên kết không thuộc chứng từ yêu cầu');
    }
    await this.request(`/items/document_payment_links/${linkId}`, {
      method: 'DELETE',
    });
    await this.recomputeSettlement(documentType, documentId);
    return { message: 'Đã gỡ liên kết thanh toán' };
  }

  async createPaymentLink(
    dto: CreateDocumentPaymentLinkDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const documentType = dto.document_type as DocumentCollection;
    if (!DOCUMENT_COLLECTIONS.includes(documentType)) {
      throw new BadRequestException('document_type không hợp lệ');
    }

    const document = await this.loadDocument(
      documentType,
      dto.document_id,
      false,
    );
    if (!document)
      throw new BadRequestException('Không tìm thấy chứng từ nghiệp vụ');

    const voucher = await this.request<{ data: any }>(
      `/items/payment_vouchers/${dto.payment_voucher_id}?fields[]=id&fields[]=status&fields[]=document_date&fields[]=amount&fields[]=voucher_direction&fields[]=voucher_type`,
    );
    if (!voucher.data)
      throw new BadRequestException('Không tìm thấy phiếu dòng tiền');
    if (!['APPROVED', 'POSTED'].includes(voucher.data.status)) {
      throw new BadRequestException(
        'Chỉ liên kết phiếu dòng tiền đã duyệt/ghi sổ',
      );
    }

    const expectedDirection =
      documentType === 'sales_service_orders' ? 'IN' : 'OUT';
    if (voucher.data.voucher_direction !== expectedDirection) {
      throw new BadRequestException(
        expectedDirection === 'IN'
          ? 'Chứng từ phải thu chỉ được liên kết phiếu thu'
          : 'Chứng từ phải trả chỉ được liên kết phiếu chi',
      );
    }

    const existingLinks = await this.findPaymentLinks(
      documentType,
      dto.document_id,
    );
    const currentSettled = existingLinks.reduce(
      (sum, link) => sum + Number(link.applied_amount || 0),
      0,
    );
    const documentTotal = Number(document.total_amount || 0);
    const voucherAmount = Number(voucher.data.amount || 0);
    const voucherAllocated = existingLinks
      .filter((link) => link.payment_voucher_id === dto.payment_voucher_id)
      .reduce((sum, link) => sum + Number(link.applied_amount || 0), 0);
    const remainingDocument = Math.max(documentTotal - currentSettled, 0);
    const remainingVoucher = Math.max(voucherAmount - voucherAllocated, 0);

    if (dto.applied_amount > remainingDocument) {
      throw new BadRequestException(
        'Số tiền cấn trừ vượt số dư còn mở của chứng từ',
      );
    }
    if (dto.applied_amount > remainingVoucher) {
      throw new BadRequestException(
        'Số tiền cấn trừ vượt số tiền khả dụng của phiếu dòng tiền',
      );
    }

    const { data } = await this.request<{ data: any }>(
      `/items/document_payment_links`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...dto,
          applied_date:
            dto.applied_date || this.normalizeDate(voucher.data.document_date),
        }),
      },
    );
    await this.recomputeSettlement(documentType, dto.document_id);
    return { message: 'Liên kết thanh toán thành công', data };
  }

  async recomputeSettlement(
    documentType: DocumentCollection,
    documentId: string,
  ) {
    const links = await this.findPaymentLinks(documentType, documentId);
    const settled = links.reduce(
      (sum, link) => sum + Number(link.applied_amount || 0),
      0,
    );
    const lastPaymentDate = links
      .map((link) => link.applied_date)
      .filter(Boolean)
      .sort()
      .at(-1);
    await this.request(`/items/${documentType}/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        settled_amount: settled,
        ...(lastPaymentDate ? { last_payment_date: lastPaymentDate } : {}),
      }),
    });
  }

  async getReceivables(query: OperationalQueryDto, userToken: string) {
    const result = await this.list('sales_service_orders', query, userToken);
    return { ...result, source: 'sales_service_orders' };
  }

  async getPayables(query: OperationalQueryDto, userToken: string) {
    this.guard(userToken);
    const purchase = await this.list('purchase_orders', query, userToken);
    const expense = await this.list('operating_expenses', query, userToken);
    const merged = [
      ...purchase.items.map((item: any) => ({
        ...item,
        document_type: 'purchase_orders',
      })),
      ...expense.items.map((item: any) => ({
        ...item,
        document_type: 'operating_expenses',
      })),
    ].sort((a, b) =>
      String(b.document_date).localeCompare(String(a.document_date)),
    );

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const total = merged.length;
    const start = (page - 1) * pageSize;
    const items = merged.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findRecurringCandidates(
    collection: PayableCollection,
    dueOnOrBefore: string,
  ) {
    const url = new URL(`/items/${collection}`, this.directusUrl);
    url.searchParams.append('limit', '200');
    url.searchParams.append('sort[]', 'next_due_date');
    url.searchParams.append('fields[]', '*');
    url.searchParams.append('filter[auto_generate_next][_eq]', 'true');
    url.searchParams.append('filter[status][_neq]', 'CANCELLED');
    url.searchParams.append('filter[next_due_date][_nnull]', 'true');
    url.searchParams.append('filter[next_due_date][_lte]', dueOnOrBefore);
    const { data } = await this.request<{ data: RecurringCandidate[] }>(
      `${url.pathname}${url.search}`,
    );
    return data || [];
  }

  async generateRecurringDocument(
    collection: PayableCollection,
    candidate: RecurringCandidate,
  ) {
    if (!candidate.auto_generate_next || !candidate.next_due_date) return null;

    const nextDueDate = this.normalizeDate(candidate.next_due_date);
    if (!nextDueDate) return null;

    const recurrenceEndDate = this.normalizeDate(candidate.recurrence_end_date);
    if (recurrenceEndDate && nextDueDate > recurrenceEndDate) return null;

    const parentRecurringId = candidate.parent_recurring_id || candidate.id;
    const existingUrl = new URL(`/items/${collection}`, this.directusUrl);
    existingUrl.searchParams.append('limit', '10');
    existingUrl.searchParams.append('fields[]', 'id');
    existingUrl.searchParams.append(
      'filter[parent_recurring_id][_eq]',
      parentRecurringId,
    );
    existingUrl.searchParams.append('filter[document_date][_eq]', nextDueDate);
    const existing = await this.request<{ data: Array<{ id: string }> }>(
      `${existingUrl.pathname}${existingUrl.search}`,
    );
    const duplicate = (existing.data || []).find(
      (row) => row.id !== candidate.id,
    );
    if (duplicate) return duplicate;

    const lines = await this.findLines(collection, candidate.id);
    const recurrenceType = candidate.recurrence_type || 'ONE_TIME';
    const recurrenceInterval = Number(candidate.recurrence_interval || 1);
    const nextCycleDueDate = this.shiftDate(
      nextDueDate,
      recurrenceType,
      recurrenceInterval,
    );

    const payload: Record<string, unknown> = {
      branch_id: candidate.branch_id || undefined,
      supplier_id: candidate.supplier_id || undefined,
      supplier_name_snapshot: candidate.supplier_name_snapshot || '',
      document_date: nextDueDate,
      due_date: nextDueDate,
      invoice_status: candidate.invoice_status || 'NO_INVOICE',
      status: 'CONFIRMED',
      total_amount: Number(candidate.total_amount || 0),
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceInterval,
      recurrence_start_date:
        this.normalizeDate(candidate.recurrence_start_date) || nextDueDate,
      recurrence_end_date: recurrenceEndDate,
      next_due_date:
        recurrenceEndDate && nextCycleDueDate > recurrenceEndDate
          ? undefined
          : nextCycleDueDate,
      auto_generate_next:
        !recurrenceEndDate || nextCycleDueDate <= recurrenceEndDate,
      parent_recurring_id: parentRecurringId,
      notes: candidate.notes || undefined,
      lines: lines.map((line) => ({
        line_no: line.line_no,
        line_type: line.line_type,
        item_code: line.item_code,
        item_name: line.item_name,
        description: line.description,
        qty: Number(line.qty ?? 1),
        unit_price: Number(line.unit_price ?? 0),
        amount: Number(line.amount ?? 0),
        notes: line.notes,
      })),
    };

    if (collection === 'operating_expenses') {
      payload.expense_category = candidate.expense_category || undefined;
      payload.title = candidate.title || candidate.expense_no || undefined;
    }

    const { data } = await this.request<{ data: { id: string } }>(
      `/items/${collection}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    await this.replaceLines(
      collection,
      data.id,
      payload.lines as OperationalLineDto[],
    );
    await this.request(`/items/${collection}/${candidate.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        parent_recurring_id: parentRecurringId,
        next_due_date:
          recurrenceEndDate && nextCycleDueDate > recurrenceEndDate
            ? null
            : nextCycleDueDate,
        auto_generate_next:
          !recurrenceEndDate || nextCycleDueDate <= recurrenceEndDate,
      }),
    });

    return data;
  }

  async importKgara(dto: any, userToken: string) {
    try {
      const records = Array.isArray(dto?.records) ? dto.records : [dto];
      const results: any[] = [];
      for (const record of records) {
        const externalId = String(
          record.id || record.caseId || record.source_document_id || '',
        );
        if (!externalId)
          throw new BadRequestException('KGARA record thiếu id/caseId');
        const payload: CreateSalesServiceOrderDto = {
          source_system: 'KGARA',
          source_document_id: externalId,
          source_document_no: String(
            record.code || record.caseNo || record.no || externalId,
          ),
          source_payload: record,
          customer_name_snapshot:
            record.customerName || record.customer_name || '',
          vehicle_plate:
            record.plateNo || record.licensePlate || record.vehicle_plate,
          vehicle_vin: record.vin || record.vehicle_vin,
          vehicle_model: record.vehicleModel || record.vehicle_model,
          document_date:
            record.closedAt || record.receivedAt || record.document_date,
          total_amount: Number(
            record.totalAmount || record.amountReceivable || record.amount || 0,
          ),
          notes: record.note || record.notes,
          status: 'CONFIRMED',
          lines: Array.isArray(record.lines)
            ? record.lines.map((line: any, index: number) => ({
                line_no: index + 1,
                line_type: line.type || 'SERVICE',
                item_code: line.code,
                item_name: line.name || line.itemName || line.description || '',
                description: line.description,
                qty: Number(line.qty || 1),
                unit_price: Number(line.unitPrice || line.unit_price || 0),
                amount: Number(line.amount || 0),
                source_payload: line,
              }))
            : [],
        };
        results.push(await this.createSales(payload, userToken));
      }
      return {
        message: 'Import KGARA thành công',
        total: results.length,
        items: results,
      };
    } catch (error) {
      this.logger.error('KGARA import failed', error as any);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Không import được KGARA');
    }
  }
}
