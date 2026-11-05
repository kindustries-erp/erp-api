import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { nextDocumentNo } from '@/common/numbering/document-numbering';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';
import { GARAGE_PROCUREMENT_ORDER_PREFIX } from '../garage-procurement-orders.constants';

/** Mã loại chứng từ của họ Garage trong nhật ký duyệt. Khớp với docType của command. */
const DOC_TYPE = 'GARAGE_PROCUREMENT_ORDER';

export interface GarageProcurementOrderFilter {
  page: number;
  pageSize: number;
  branchId?: string;
  status?: string;
  supplierId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/** Cột có thể lọc/sắp xếp trên lưới. Khóa là mã kỹ thuật, nhãn dịch ở web. */
export const GARAGE_PROCUREMENT_ORDER_COLUMNS = [
  { key: 'orderNo', type: 'text', sortable: true },
  { key: 'orderDate', type: 'date', sortable: true },
  { key: 'supplierName', type: 'text', sortable: true },
  { key: 'status', type: 'enum', sortable: true },
  { key: 'fulfillmentStatus', type: 'enum', sortable: true },
  { key: 'totalAmount', type: 'number', sortable: true },
  { key: 'paymentStatus', type: 'enum', sortable: true },
  { key: 'supplierInvoiceNo', type: 'text', sortable: false },
] as const;

@Injectable()
export class GarageProcurementOrderQueryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarageProcurementOrder)
    private readonly headers: Repository<GarageProcurementOrder>,
    @InjectRepository(GarageProcurementOrderLine)
    private readonly lines: Repository<GarageProcurementOrderLine>,
    @InjectRepository(GarageProcurementOrderAcceptance)
    private readonly acceptances: Repository<GarageProcurementOrderAcceptance>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
  ) {}

  /** Nhật ký duyệt của một đơn mua Garage, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async list(filter: GarageProcurementOrderFilter) {
    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :notDeleted', { notDeleted: false });
    if (filter.branchId) {
      qb.andWhere('h.branchId = :branchId', { branchId: filter.branchId });
    }
    if (filter.status) {
      qb.andWhere('h.status = :status', { status: filter.status });
    }
    if (filter.supplierId) {
      qb.andWhere('h.supplierId = :supplierId', {
        supplierId: filter.supplierId,
      });
    }
    if (filter.dateFrom) {
      qb.andWhere('h.orderDate >= :dateFrom', { dateFrom: filter.dateFrom });
    }
    if (filter.dateTo) {
      qb.andWhere('h.orderDate <= :dateTo', { dateTo: filter.dateTo });
    }
    if (filter.search) {
      qb.andWhere('(h.orderNo ILIKE :q OR h.supplierName ILIKE :q)', {
        q: `%${filter.search}%`,
      });
    }
    const [rows, total] = await qb
      .orderBy('h.createdAt', 'DESC')
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize)
      .getManyAndCount();
    return { rows, total, page: filter.page, pageSize: filter.pageSize };
  }

  /** Số đơn kế tiếp theo ngày (xem trước, chưa giữ số). */
  async nextNo(date?: string): Promise<string> {
    return this.dataSource.transaction((manager) =>
      nextDocumentNo(
        manager,
        GarageProcurementOrder,
        'orderNo',
        GARAGE_PROCUREMENT_ORDER_PREFIX,
        date,
      ),
    );
  }

  columnOptions() {
    return { columns: GARAGE_PROCUREMENT_ORDER_COLUMNS };
  }

  async findOne(id: string) {
    const header = await this.headers.findOne({
      where: { id, isDeleted: false },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đơn mua');
    const lines = await this.lines.find({
      where: { orderId: id },
      order: { lineNo: 'ASC' },
    });
    const acceptances = await this.acceptances.find({
      where: { orderId: id },
      order: { acceptedAt: 'ASC' },
    });
    return { header, lines, acceptances };
  }
}
