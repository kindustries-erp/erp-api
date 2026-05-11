import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArWorkbenchQueryDto } from './dto/ar-workbench-query.dto';
import { CreateArDocumentDto } from './dto/create-ar-document.dto';
import { UpdateArDocumentDto } from './dto/update-ar-document.dto';
import { CreateArApplicationDto } from './dto/create-ar-application.dto';
import { CreateArCollectionActivityDto } from './dto/create-ar-collection-activity.dto';
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
  document_date: string;
  posting_date: string;
  due_date?: string | null;
  total_amount: number | string;
  settled_amount: number | string;
  open_amount: number | string;
  status: string;
  risk_status?: string;
  collection_status?: string;
};

const AR_COVERAGE = [
  { id: 1, use_case: 'Bán hàng công nợ', status: 'phase1_supported', route: 'ar_documents:INVOICE' },
  { id: 2, use_case: 'Bán hàng thu tiền ngay', status: 'phase1_supported', route: 'ar_documents:IMMEDIATE_SALE + ar_applications:PAYMENT' },
  { id: 3, use_case: 'Khách đặt cọc trước', status: 'phase1_supported', route: 'ar_documents:ADVANCE' },
  { id: 4, use_case: 'Cấn trừ tiền cọc', status: 'phase1_supported', route: 'ar_applications:ADVANCE_APPLIED' },
  { id: 5, use_case: 'Một payment trả nhiều invoice', status: 'phase1_supported', route: 'multiple ar_applications per payment_voucher_id' },
  { id: 6, use_case: 'Một invoice nhận nhiều payment', status: 'phase1_supported', route: 'multiple ar_applications per target_document_id' },
  { id: 7, use_case: 'Thanh toán dư', status: 'phase1_supported', route: 'ar_documents:ADVANCE/SUSPENSE for unapplied cash' },
  { id: 8, use_case: 'Thanh toán thiếu', status: 'phase1_supported', route: 'partial status + WRITE_OFF application' },
  { id: 9, use_case: 'Chưa xác định khách chuyển tiền', status: 'phase1_supported', route: 'ar_documents:SUSPENSE' },
  { id: 10, use_case: 'Xác định lại khoản treo', status: 'phase1_supported', route: 'ar_applications:SUSPENSE_CLEARING' },
  { id: 11, use_case: 'Giảm giá sau bán', status: 'phase1_supported', route: 'ar_documents:CREDIT_NOTE' },
  { id: 12, use_case: 'Hàng bán bị trả lại', status: 'phase1_supported', route: 'ar_documents:SALES_RETURN' },
  { id: 13, use_case: 'Invoice disputed', status: 'phase1_supported', route: 'dispute_status/status + collection activity DISPUTE' },
  { id: 14, use_case: 'Nợ quá hạn', status: 'phase1_supported', route: 'due_date + overdue filters/summary' },
  { id: 15, use_case: 'Trích lập dự phòng nợ xấu', status: 'phase1_foundation', route: 'risk_status BAD_DEBT_RISK + collection BAD_DEBT_REVIEW' },
  { id: 16, use_case: 'Xóa nợ xấu', status: 'phase1_foundation', route: 'ar_documents/application WRITE_OFF' },
  { id: 17, use_case: 'Refund khách hàng', status: 'phase1_supported', route: 'ar_documents:REFUND + ar_applications:REFUND' },
  { id: 18, use_case: 'Bù trừ công nợ', status: 'phase1_supported', route: 'ar_applications:CUSTOMER_VENDOR_OFFSET' },
  { id: 19, use_case: 'Thu hộ / đại lý', status: 'phase1_foundation', route: 'ar_documents:SUSPENSE/ADJUSTMENT metadata' },
  { id: 20, use_case: 'COD', status: 'phase1_supported', route: 'ar_documents:COD' },
  { id: 21, use_case: 'COD chuyển tiền về', status: 'phase1_supported', route: 'ar_applications:COD_SETTLEMENT' },
  { id: 22, use_case: 'Payment gateway', status: 'phase1_supported', route: 'ar_documents:GATEWAY + GATEWAY_SETTLEMENT metadata fee' },
  { id: 23, use_case: 'Thu ngoại tệ', status: 'phase1_foundation', route: 'currency/exchange_rate + FX_REALIZED' },
  { id: 24, use_case: 'Đánh giá lại tỷ giá cuối kỳ', status: 'phase1_foundation', route: 'ar_documents:FX_REVALUATION' },
  { id: 25, use_case: 'Công nợ theo hợp đồng', status: 'phase1_supported', route: 'ar_documents:CONTRACT_MILESTONE' },
  { id: 26, use_case: 'Retention receivable', status: 'phase1_supported', route: 'ar_documents:RETENTION' },
  { id: 27, use_case: 'Intercompany receivable', status: 'phase1_supported', route: 'ar_documents:INTERCOMPANY' },
  { id: 28, use_case: 'Write-off nhỏ', status: 'phase1_supported', route: 'ar_applications:WRITE_OFF' },
  { id: 29, use_case: 'Thu sai công ty', status: 'phase1_foundation', route: 'SUSPENSE + metadata company evidence' },
  { id: 30, use_case: 'Reverse invoice', status: 'phase1_foundation', route: 'status REVERSED + reversal references in metadata' },
  { id: 31, use_case: 'Reverse payment', status: 'phase1_foundation', route: 'application status REVERSED + reverse voucher link' },
  { id: 32, use_case: 'Collection workflow', status: 'phase1_supported', route: 'ar_collection_activities' },
  { id: 33, use_case: 'Promise to pay', status: 'phase1_supported', route: 'promise_to_pay_date + activity PROMISE_TO_PAY' },
  { id: 34, use_case: 'Bad debt legal case', status: 'phase1_supported', route: 'activity LEGAL_CASE + risk LEGAL' },
  { id: 35, use_case: 'Advance chưa dùng hết', status: 'phase1_supported', route: 'ADVANCE open_amount' },
  { id: 36, use_case: 'Khách trả nhầm invoice', status: 'phase1_supported', route: 'ar_applications:REALLOCATION' },
  { id: 37, use_case: 'Thu tiền mặt', status: 'existing_supported', route: 'payment_vouchers CASH_RECEIPT + AR application' },
  { id: 38, use_case: 'Thu qua ngân hàng', status: 'existing_supported', route: 'payment_vouchers BANK_RECEIPT + AR application' },
  { id: 39, use_case: 'Thu qua ví điện tử', status: 'phase1_foundation', route: 'GATEWAY metadata pending settlement' },
  { id: 40, use_case: 'Chưa reconcile bank', status: 'phase1_foundation', route: 'metadata reconciliation status + payment voucher link' },
];

@Injectable()
export class ArWorkbenchService {
  private readonly logger = new Logger(ArWorkbenchService.name);

  constructor(private readonly configService: ConfigService) {}

  private get directusUrl() {
    return this.configService.getOrThrow<string>('DIRECTUS_URL');
  }

  private guard(userToken: string) {
    if (!userToken) throw new UnauthorizedException('Yêu cầu User Token');
  }

  private async request<T>(path: string, userToken: string, init: RequestInit = {}): Promise<T> {
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
      await throwDirectusResponseError(response, 'Không thể xử lý AR Workbench');
    }
    return (await response.json()) as T;
  }

  private pagination(query: ArWorkbenchQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    return { page, pageSize, offset: (page - 1) * pageSize, sort: query.sort || '-created_at' };
  }

  private appendDocumentFilter(url: URL, query: ArWorkbenchQueryDto) {
    const filterAnd: any[] = [];
    if (query.business_partner_id) filterAnd.push({ business_partner_id: { _eq: query.business_partner_id } });
    if (query.document_type) filterAnd.push({ document_type: { _eq: query.document_type } });
    if (query.status) filterAnd.push({ status: { _eq: query.status } });
    if (query.risk_status) filterAnd.push({ risk_status: { _eq: query.risk_status } });
    if (query.open_only) filterAnd.push({ status: { _in: ['POSTED', 'PARTIAL'] } }, { open_amount: { _gt: 0 } });
    if (query.overdue) {
      filterAnd.push({ due_date: { _lt: new Date().toISOString().slice(0, 10) } });
      filterAnd.push({ status: { _in: ['POSTED', 'PARTIAL'] } }, { open_amount: { _gt: 0 } });
    }
    if (filterAnd.length > 0) url.searchParams.append('filter', JSON.stringify({ _and: filterAnd }));
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
      const result = await this.request<DirectusList<ArDocument>>(url.pathname + url.search, userToken);
      const total = result.meta?.filter_count || 0;
      return { items: result.data || [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    } catch (error: any) {
      this.logger.error('Lỗi khi lấy danh sách AR documents', error);
      rethrowHttpException(error);
      throw new InternalServerErrorException('Không thể lấy danh sách AR documents');
    }
  }

  async createDocument(dto: CreateArDocumentDto, userToken: string) {
    if (dto.status && ['REVERSED', 'CANCELLED'].includes(dto.status)) {
      throw new BadRequestException('Không tạo mới trực tiếp chứng từ trạng thái reversed/cancelled');
    }
    const result = await this.request<{ data: ArDocument }>('/items/ar_documents', userToken, {
      method: 'POST',
      body: JSON.stringify({ ...dto, status: dto.status || 'DRAFT' }),
    });
    return { message: 'Tạo AR document thành công', data: result.data };
  }

  async updateDocument(id: string, dto: UpdateArDocumentDto, userToken: string) {
    const result = await this.request<{ data: ArDocument }>(`/items/ar_documents/${id}`, userToken, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
    return { message: 'Cập nhật AR document thành công', data: result.data };
  }

  async findApplications(query: ArWorkbenchQueryDto, userToken: string) {
    const { page, pageSize, offset, sort } = this.pagination(query);
    const url = new URL('/items/ar_applications', this.directusUrl);
    url.searchParams.append('limit', pageSize.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('meta', 'filter_count');
    url.searchParams.append('sort[]', sort);
    const result = await this.request<DirectusList<any>>(url.pathname + url.search, userToken);
    const total = result.meta?.filter_count || 0;
    return { items: result.data || [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async createApplication(dto: CreateArApplicationDto, userToken: string) {
    if (!dto.target_document_id && !dto.payment_voucher_id) {
      throw new BadRequestException('Application cần target_document_id hoặc payment_voucher_id');
    }
    const result = await this.request<{ data: any }>('/items/ar_applications', userToken, {
      method: 'POST',
      body: JSON.stringify({ ...dto, status: dto.status || 'POSTED' }),
    });
    return { message: 'Tạo AR application thành công', data: result.data };
  }

  async findCollectionActivities(query: ArWorkbenchQueryDto, userToken: string) {
    const { page, pageSize, offset, sort } = this.pagination(query);
    const url = new URL('/items/ar_collection_activities', this.directusUrl);
    url.searchParams.append('limit', pageSize.toString());
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('meta', 'filter_count');
    url.searchParams.append('sort[]', sort);
    if (query.business_partner_id) {
      url.searchParams.append('filter', JSON.stringify({ business_partner_id: { _eq: query.business_partner_id } }));
    }
    const result = await this.request<DirectusList<any>>(url.pathname + url.search, userToken);
    const total = result.meta?.filter_count || 0;
    return { items: result.data || [], total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async createCollectionActivity(dto: CreateArCollectionActivityDto, userToken: string) {
    const result = await this.request<{ data: any }>('/items/ar_collection_activities', userToken, {
      method: 'POST',
      body: JSON.stringify({ ...dto, activity_date: dto.activity_date || new Date().toISOString().slice(0, 10) }),
    });
    return { message: 'Tạo hoạt động thu hồi công nợ thành công', data: result.data };
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
    const result = await this.request<DirectusList<ArDocument>>(url.pathname + url.search, userToken);
    const today = new Date().toISOString().slice(0, 10);
    const by_type: Record<string, { count: number; open_amount: number; total_amount: number }> = {};
    const totals = { count: 0, total_amount: 0, settled_amount: 0, open_amount: 0, overdue_amount: 0 };
    for (const doc of result.data || []) {
      const total = Number(doc.total_amount) || 0;
      const settled = Number(doc.settled_amount) || 0;
      const open = Number(doc.open_amount) || 0;
      totals.count += 1;
      totals.total_amount += total;
      totals.settled_amount += settled;
      totals.open_amount += open;
      if (doc.due_date && doc.due_date < today && ['POSTED', 'PARTIAL'].includes(doc.status)) totals.overdue_amount += open;
      by_type[doc.document_type] = by_type[doc.document_type] || { count: 0, open_amount: 0, total_amount: 0 };
      by_type[doc.document_type].count += 1;
      by_type[doc.document_type].open_amount += open;
      by_type[doc.document_type].total_amount += total;
    }
    return { totals, by_type, coverage: AR_COVERAGE };
  }

  getCoverage() {
    return { items: AR_COVERAGE, total: AR_COVERAGE.length };
  }
}
