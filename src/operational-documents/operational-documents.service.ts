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
  CreateInventoryItemDto,
  CreateInventoryTransactionDto,
  CreateOperatingExpenseDto,
  CreatePurchaseOrderDto,
  CreateSalesServiceOrderDto,
  OperationalLineDto,
  OperationalQueryDto,
  PostPurchaseReceiptDto,
  PostSalesIssueDto,
} from './dto/operational-document.dto';

type InventoryTransactionType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

const DOCUMENT_COLLECTIONS = [
  'sales_service_orders',
  'purchase_orders',
  'operating_expenses',
] as const;

const PAYABLE_COLLECTIONS = ['purchase_orders', 'operating_expenses'] as const;
const PAYMENT_LINK_ALLOWED_VOUCHER_STATUSES = [
  'APPROVED',
  'CONFIRMED',
] as const;

type DocumentCollection = (typeof DOCUMENT_COLLECTIONS)[number];
type PayableCollection = (typeof PAYABLE_COLLECTIONS)[number];
type InventoryPostingCollection = 'purchase_orders' | 'sales_service_orders';

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

  private async findPaymentLinksByVoucher(paymentVoucherId: string) {
    const path = `/items/document_payment_links?filter[payment_voucher_id][_eq]=${paymentVoucherId}&fields[]=id&fields[]=payment_voucher_id&fields[]=applied_amount&fields[]=document_type&fields[]=document_id`;
    const { data } = await this.request<{ data: any[] }>(path);
    return data || [];
  }

  private partnerFieldForDocument(documentType: DocumentCollection) {
    return documentType === 'sales_service_orders'
      ? 'customer_id'
      : 'supplier_id';
  }

  private expectedPartnerId(documentType: DocumentCollection, document: any) {
    const field = this.partnerFieldForDocument(documentType);
    return document?.[field] || null;
  }

  private normalizeDirectusErrorMessage(error: unknown) {
    if (!(error instanceof BadRequestException)) throw error;
    const response = error.getResponse();
    const raw =
      typeof response === 'string'
        ? response
        : typeof response === 'object' && response && 'message' in response
          ? (response as any).message
          : null;
    const text = Array.isArray(raw) ? raw.join('; ') : String(raw || '');
    if (
      text.includes('inventory_tx_receipt_issue_source_line_guard_idx') ||
      text.includes('inventory_tx_issue_source_line_guard_idx') ||
      text.includes('duplicate key value violates unique constraint')
    ) {
      throw new BadRequestException(
        'Chứng từ đã được post kho trước đó cho ít nhất một dòng vật tư',
      );
    }
    throw error;
  }

  private inventoryStatusField(collection: InventoryPostingCollection) {
    return 'inventory_status';
  }

  private isInventoryEligibleLine(line: any) {
    return Boolean(line?.inventory_item_id) && Number(line?.qty || 0) > 0;
  }

  private async updateInventoryStatus(
    collection: InventoryPostingCollection,
    documentId: string,
    inventoryStatus: string,
  ) {
    await this.request(`/items/${collection}/${documentId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        [this.inventoryStatusField(collection)]: inventoryStatus,
      }),
    });
  }

  private async listInventoryTransactionsBySource(
    collection: InventoryPostingCollection,
    documentId: string,
    transactionType?: InventoryTransactionType,
  ) {
    const url = new URL('/items/inventory_transactions', this.directusUrl);
    url.searchParams.append('limit', '-1');
    url.searchParams.append('fields[]', '*');
    url.searchParams.append('fields[]', 'source_line_id');
    url.searchParams.append('filter[source_type][_eq]', collection);
    url.searchParams.append('filter[source_id][_eq]', documentId);
    if (transactionType) {
      url.searchParams.append('filter[transaction_type][_eq]', transactionType);
    }
    const { data } = await this.request<{ data: any[] }>(
      `${url.pathname}${url.search}`,
    );
    return data || [];
  }

  private async getInventoryAverageCosts(
    itemIds: string[],
    branchId?: string | null,
  ) {
    const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
    const costs = new Map<
      string,
      { onHandQty: number; stockValue: number; avgCost: number }
    >();
    if (!uniqueItemIds.length) return costs;

    const url = new URL('/items/inventory_transactions', this.directusUrl);
    url.searchParams.append('limit', '-1');
    url.searchParams.append('fields[]', '*');
    uniqueItemIds.forEach((id) =>
      url.searchParams.append('filter[inventory_item_id][_in][]', id),
    );
    if (branchId) {
      url.searchParams.append('filter[branch_id][_eq]', branchId);
    }
    const { data } = await this.request<{ data: any[] }>(
      `${url.pathname}${url.search}`,
    );

    for (const itemId of uniqueItemIds) {
      let onHandQty = 0;
      let stockValue = 0;
      for (const tx of (data || []).filter(
        (row) => row.inventory_item_id === itemId,
      )) {
        const qty = Number(tx.qty || 0);
        const amount = Number(tx.amount || 0);
        if (this.isInboundInventory(tx.transaction_type)) {
          onHandQty += qty;
          stockValue += amount;
        } else if (this.isOutboundInventory(tx.transaction_type)) {
          onHandQty -= qty;
          stockValue -= amount;
        }
      }
      const avgCost = onHandQty > 0 ? stockValue / onHandQty : 0;
      costs.set(itemId, { onHandQty, stockValue, avgCost });
    }
    return costs;
  }

  private async createInventoryTransactionsForDocument(
    collection: InventoryPostingCollection,
    document: any,
    lines: any[],
    transactionType: 'RECEIPT' | 'ISSUE',
    transactionDate?: string,
    notes?: string,
  ) {
    const eligibleLines = lines.filter((line) =>
      this.isInventoryEligibleLine(line),
    );
    if (!eligibleLines.length) {
      throw new BadRequestException(
        'Chứng từ không có dòng vật tư/phụ tùng hợp lệ để post kho',
      );
    }

    const normalizedDate =
      this.normalizeDate(transactionDate) ||
      this.normalizeDate(document.document_date) ||
      this.normalizeDate(new Date().toISOString());

    const averageCosts =
      transactionType === 'ISSUE'
        ? await this.getInventoryAverageCosts(
            eligibleLines.map((line) => line.inventory_item_id),
            document.branch_id || null,
          )
        : new Map();

    for (const line of eligibleLines) {
      const qty = Number(line.qty || 0);
      const receiptUnitCost = Number(line.unit_price || 0);
      const issueCostState = averageCosts.get(line.inventory_item_id);
      const unitCost =
        transactionType === 'ISSUE'
          ? Number(issueCostState?.avgCost || 0)
          : receiptUnitCost;
      const amount = Number((qty * unitCost).toFixed(2));
      try {
        await this.request('/items/inventory_transactions', {
          method: 'POST',
          body: JSON.stringify({
            branch_id: document.branch_id || null,
            inventory_item_id: line.inventory_item_id,
            transaction_type: transactionType,
            transaction_date: normalizedDate,
            qty,
            unit_cost: unitCost,
            amount,
            source_type: collection,
            source_id: document.id,
            source_line_id: line.id || null,
            notes:
              notes ||
              `${transactionType === 'RECEIPT' ? 'Receipt' : 'Issue'} từ ${this.documentNoField(collection)} ${document[this.documentNoField(collection)] || document.id}`,
          }),
        });
      } catch (error) {
        this.normalizeDirectusErrorMessage(error);
      }
    }
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
      `/items/payment_vouchers/${dto.payment_voucher_id}?fields[]=id&fields[]=status&fields[]=document_date&fields[]=amount&fields[]=voucher_direction&fields[]=voucher_type&fields[]=counterparty_id`,
    );
    if (!voucher.data)
      throw new BadRequestException('Không tìm thấy phiếu dòng tiền');
    if (!PAYMENT_LINK_ALLOWED_VOUCHER_STATUSES.includes(voucher.data.status)) {
      throw new BadRequestException(
        'Chỉ liên kết phiếu dòng tiền đã duyệt/xác nhận',
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

    const expectedPartnerId = this.expectedPartnerId(documentType, document);
    if (!expectedPartnerId) {
      throw new BadRequestException(
        'Chứng từ chưa có đối tác để liên kết dòng tiền',
      );
    }
    if (!voucher.data.counterparty_id) {
      throw new BadRequestException('Phiếu dòng tiền chưa có đối tác');
    }
    if (voucher.data.counterparty_id !== expectedPartnerId) {
      throw new BadRequestException(
        'Phiếu dòng tiền không cùng đối tác với chứng từ',
      );
    }

    const existingLinks = await this.findPaymentLinks(
      documentType,
      dto.document_id,
    );
    const voucherLinks = await this.findPaymentLinksByVoucher(
      dto.payment_voucher_id,
    );
    const currentSettled = existingLinks.reduce(
      (sum, link) => sum + Number(link.applied_amount || 0),
      0,
    );
    const documentTotal = Number(document.total_amount || 0);
    const voucherAmount = Number(voucher.data.amount || 0);
    const voucherAllocated = voucherLinks.reduce(
      (sum, link) => sum + Number(link.applied_amount || 0),
      0,
    );
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

  private async listCollection(collection: string, query: OperationalQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const url = new URL(`/items/${collection}`, this.directusUrl);
    url.searchParams.append('limit', String(pageSize));
    url.searchParams.append('offset', String(offset));
    url.searchParams.append('meta', 'filter_count');
    if (query.sort) url.searchParams.append('sort[]', query.sort);
    if (query.search) url.searchParams.append('search', query.search);
    if (query.branch_id)
      url.searchParams.append('filter[branch_id][_eq]', query.branch_id);
    if (query.inventory_item_id)
      url.searchParams.append(
        'filter[inventory_item_id][_eq]',
        query.inventory_item_id,
      );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.adminToken}` },
    });
    if (!res.ok) throw new BadRequestException(await res.text());
    const result = await res.json();
    const total = result.meta?.filter_count || 0;
    return {
      items: result.data || [],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  listInventoryItems(query: OperationalQueryDto, userToken: string) {
    this.guard(userToken);
    return this.listCollection('inventory_items', {
      ...query,
      sort: query.sort || 'item_code',
    });
  }

  listInventoryTransactions(query: OperationalQueryDto, userToken: string) {
    this.guard(userToken);
    return this.listCollection('inventory_transactions', {
      ...query,
      sort: query.sort || '-transaction_date',
    });
  }

  async createInventoryItem(dto: CreateInventoryItemDto, userToken: string) {
    this.guard(userToken);
    const fallbackCode = `ITEM-${Date.now().toString(36).toUpperCase()}`;
    const { data } = await this.request<{ data: any }>(
      '/items/inventory_items',
      {
        method: 'POST',
        body: JSON.stringify({
          item_code: dto.item_code || fallbackCode,
          item_name: dto.item_name,
          item_type: dto.item_type || 'PART',
          unit: dto.unit || 'PCS',
          is_active: dto.is_active ?? true,
          notes: dto.notes,
        }),
      },
    );
    return { data };
  }

  async createInventoryTransaction(
    dto: CreateInventoryTransactionDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const qty = Number(dto.qty);
    const unitCost = Number(dto.unit_cost || 0);
    const amount = Number(dto.amount ?? qty * unitCost);
    try {
      const { data } = await this.request<{ data: any }>(
        '/items/inventory_transactions',
        {
          method: 'POST',
          body: JSON.stringify({
            ...dto,
            qty,
            unit_cost: unitCost,
            amount,
          }),
        },
      );
      return { data };
    } catch (error) {
      this.normalizeDirectusErrorMessage(error);
    }
  }

  async postPurchaseReceipt(
    id: string,
    dto: PostPurchaseReceiptDto,
    userToken: string,
  ) {
    this.guard(userToken);
    const document = await this.loadDocument('purchase_orders', id, true);
    if (!document) throw new NotFoundException('Không tìm thấy chứng từ');
    if (document.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Chỉ PO trạng thái CONFIRMED mới được nhập kho',
      );
    }
    if (document.inventory_status === 'FULLY_RECEIVED') {
      throw new BadRequestException(
        'PO đã nhập đủ, không thể post nhập kho lại',
      );
    }

    const lines = Array.isArray(document.lines) ? document.lines : [];
    const inventoryLines = lines.filter((line) =>
      this.isInventoryEligibleLine(line),
    );
    if (!inventoryLines.length) {
      throw new BadRequestException(
        'Chứng từ không có dòng vật tư/phụ tùng hợp lệ để post kho',
      );
    }

    const existingReceipts = await this.listInventoryTransactionsBySource(
      'purchase_orders',
      id,
      'RECEIPT',
    );
    const receivedQtyByLine = new Map<string, number>();
    for (const tx of existingReceipts) {
      if (!tx.source_line_id) continue;
      receivedQtyByLine.set(
        tx.source_line_id,
        Number(receivedQtyByLine.get(tx.source_line_id) || 0) +
          Number(tx.qty || 0),
      );
    }

    const lineStates = inventoryLines.map((line) => {
      const originalQty = Number(line.qty || 0);
      const receivedQty = Number(receivedQtyByLine.get(line.id) || 0);
      const remainingQty = Number((originalQty - receivedQty).toFixed(4));
      return {
        ...line,
        originalQty,
        receivedQty,
        remainingQty,
      };
    });

    let linesToPost = lineStates.filter((line) => line.remainingQty > 0);

    if (Array.isArray(dto.receipt_lines) && dto.receipt_lines.length) {
      const requestedMap = new Map(
        dto.receipt_lines
          .filter((line) => line.line_id)
          .map((line) => [line.line_id as string, line]),
      );
      linesToPost = linesToPost.filter((line) => requestedMap.has(line.id));
      if (!linesToPost.length) {
        throw new BadRequestException(
          'Không còn dòng vật tư hợp lệ để nhập kho theo lựa chọn hiện tại',
        );
      }
      linesToPost = linesToPost.map((line) => {
        const requested = requestedMap.get(line.id);
        const requestedQty = Number(requested?.qty || line.remainingQty || 0);
        if (requestedQty <= 0) {
          throw new BadRequestException('Số lượng nhập kho phải lớn hơn 0');
        }
        if (requestedQty > line.remainingQty) {
          throw new BadRequestException(
            'Số lượng nhập kho không được vượt số lượng còn lại của dòng PO',
          );
        }
        return {
          ...line,
          qty: requestedQty,
          amount: Number(
            (requestedQty * Number(line.unit_price || 0)).toFixed(2),
          ),
        };
      });
    }

    if (!linesToPost.length) {
      throw new BadRequestException(
        'PO không còn số lượng vật tư cần nhập kho',
      );
    }

    await this.createInventoryTransactionsForDocument(
      'purchase_orders',
      document,
      linesToPost,
      'RECEIPT',
      dto.transaction_date,
      dto.notes,
    );

    const nextStatus = lineStates.every((line) => {
      const postedNow = linesToPost
        .filter((posted) => posted.id === line.id)
        .reduce((sum, posted) => sum + Number(posted.qty || 0), 0);
      return line.receivedQty + postedNow >= line.originalQty;
    })
      ? 'FULLY_RECEIVED'
      : 'PARTIAL';
    await this.updateInventoryStatus('purchase_orders', id, nextStatus);
    return this.findOne('purchase_orders', id, userToken);
  }

  async postSalesIssue(id: string, dto: PostSalesIssueDto, userToken: string) {
    this.guard(userToken);
    const document = await this.loadDocument('sales_service_orders', id, true);
    if (!document)
      throw new NotFoundException('Không tìm thấy Sales/Service Order');
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(document.status)) {
      throw new BadRequestException(
        'Chỉ Sales/Service trạng thái CONFIRMED hoặc IN_PROGRESS mới được xuất kho',
      );
    }
    if (document.inventory_status === 'ISSUED') {
      throw new BadRequestException('Chứng từ đã xuất kho, không thể post lại');
    }

    const lines = Array.isArray(document.lines) ? document.lines : [];
    const eligibleLines = lines.filter((line) =>
      this.isInventoryEligibleLine(line),
    );
    if (!eligibleLines.length) {
      throw new BadRequestException(
        'Chứng từ không có dòng vật tư/phụ tùng hợp lệ để xuất kho',
      );
    }

    const existingIssues = await this.listInventoryTransactionsBySource(
      'sales_service_orders',
      id,
      'ISSUE',
    );
    const issuedQtyByLine = new Map<string, number>();
    for (const tx of existingIssues) {
      const lineId = tx.source_line_id || null;
      if (!lineId) continue;
      issuedQtyByLine.set(
        lineId,
        Number((issuedQtyByLine.get(lineId) || 0) + Number(tx.qty || 0)),
      );
    }

    const requestLines = Array.isArray(dto.issue_lines) ? dto.issue_lines : [];
    const requestLineMap = new Map<string, number>();
    for (const line of requestLines) {
      if (!line?.line_id) {
        throw new BadRequestException('issue_lines.line_id là bắt buộc');
      }
      const qty = Number(line.qty || 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException('issue_lines.qty phải lớn hơn 0');
      }
      requestLineMap.set(line.line_id, qty);
    }

    const linesToPost = eligibleLines
      .map((line) => {
        const lineQty = Number(line.qty || 0);
        const issuedQty = Number(issuedQtyByLine.get(line.id) || 0);
        const remainingQty = Number((lineQty - issuedQty).toFixed(4));
        if (remainingQty <= 0) return null;
        const requestedQty = requestLineMap.has(line.id)
          ? Number(requestLineMap.get(line.id) || 0)
          : requestLines.length
            ? 0
            : remainingQty;
        if (requestedQty <= 0) return null;
        if (requestedQty > remainingQty) {
          throw new BadRequestException(
            `Dòng ${line.line_no || line.id}: số lượng xuất vượt quá còn lại ${remainingQty}`,
          );
        }
        return {
          ...line,
          qty: requestedQty,
          source_payload: {
            ...(line.source_payload || {}),
            requested_qty: requestedQty,
            remaining_qty_before_post: remainingQty,
          },
        };
      })
      .filter(Boolean) as any[];

    if (!linesToPost.length) {
      throw new BadRequestException(
        'Sales/Service không còn số lượng vật tư cần xuất kho',
      );
    }

    await this.createInventoryTransactionsForDocument(
      'sales_service_orders',
      document,
      linesToPost,
      'ISSUE',
      dto.transaction_date,
      dto.notes,
    );

    const totalIssueQty = eligibleLines.reduce(
      (sum, line) => sum + Number(line.qty || 0),
      0,
    );
    const issuedAfterPost =
      existingIssues.reduce((sum, tx) => sum + Number(tx.qty || 0), 0) +
      linesToPost.reduce((sum, line) => sum + Number(line.qty || 0), 0);

    await this.updateInventoryStatus(
      'sales_service_orders',
      id,
      issuedAfterPost >= totalIssueQty ? 'ISSUED' : 'PARTIAL',
    );
    return this.findOne('sales_service_orders', id, userToken);
  }

  private isInboundInventory(type: string) {
    return ['RECEIPT', 'ADJUSTMENT_IN', 'TRANSFER_IN'].includes(type);
  }

  private isOutboundInventory(type: string) {
    return ['ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'].includes(type);
  }

  async getInventoryStock(query: OperationalQueryDto, userToken: string) {
    this.guard(userToken);
    const url = new URL('/items/inventory_transactions', this.directusUrl);
    url.searchParams.append('limit', '-1');
    url.searchParams.append('fields[]', '*');
    url.searchParams.append('fields[]', 'source_line_id');
    if (query.branch_id)
      url.searchParams.append('filter[branch_id][_eq]', query.branch_id);
    if (query.inventory_item_id)
      url.searchParams.append(
        'filter[inventory_item_id][_eq]',
        query.inventory_item_id,
      );
    const { data: txs } = await this.request<{ data: any[] }>(
      `${url.pathname}${url.search}`,
    );
    const itemIds = Array.from(
      new Set((txs || []).map((tx) => tx.inventory_item_id).filter(Boolean)),
    );
    const itemMap = new Map<string, any>();
    if (itemIds.length) {
      const itemUrl = new URL('/items/inventory_items', this.directusUrl);
      itemUrl.searchParams.append('limit', '-1');
      itemUrl.searchParams.append('fields[]', '*');
      for (const id of itemIds)
        itemUrl.searchParams.append('filter[id][_in][]', id);
      const { data: items } = await this.request<{ data: any[] }>(
        `${itemUrl.pathname}${itemUrl.search}`,
      );
      for (const item of items || []) itemMap.set(item.id, item);
    }
    const byKey = new Map<string, any>();
    for (const tx of txs || []) {
      const key = `${tx.inventory_item_id || 'unknown'}:${tx.branch_id || ''}`;
      const current = byKey.get(key) || {
        inventory_item_id: tx.inventory_item_id,
        branch_id: tx.branch_id,
        item_code: itemMap.get(tx.inventory_item_id)?.item_code || '',
        item_name: itemMap.get(tx.inventory_item_id)?.item_name || '',
        unit: itemMap.get(tx.inventory_item_id)?.unit || 'PCS',
        received_qty: 0,
        issued_qty: 0,
        on_hand_qty: 0,
        stock_value: 0,
        last_transaction_date: null,
      };
      const qty = Number(tx.qty || 0);
      const amount = Number(tx.amount || 0);
      if (this.isInboundInventory(tx.transaction_type)) {
        current.received_qty += qty;
        current.on_hand_qty += qty;
        current.stock_value += amount;
      } else if (this.isOutboundInventory(tx.transaction_type)) {
        current.issued_qty += qty;
        current.on_hand_qty -= qty;
        current.stock_value -= amount;
      }
      if (
        !current.last_transaction_date ||
        String(tx.transaction_date) > String(current.last_transaction_date)
      ) {
        current.last_transaction_date = tx.transaction_date;
      }
      byKey.set(key, current);
    }
    const items = Array.from(byKey.values()).sort((a, b) =>
      String(a.item_code).localeCompare(String(b.item_code)),
    );
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const start = (page - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      total: items.length,
      page,
      pageSize,
      totalPages: Math.ceil(items.length / pageSize),
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
