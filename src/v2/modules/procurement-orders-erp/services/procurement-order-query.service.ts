import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementOrder } from '../entities/procurement-order.entity';
import { ProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { ProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import {
  computeTableSummaries,
  TableSummaryColumn,
} from '@/common/utils/table-query';

/** Mã loại chứng từ trong nhật ký duyệt. Khớp với docType của command. */
const DOC_TYPE = 'PROCUREMENT_ORDER';

/** Cột số được cộng vào `summaries` của danh sách PO erp. */
const SUMMARY_COLUMNS: TableSummaryColumn[] = [
  { key: 'totalAmount', sql: 'h.totalAmount' },
];

@Injectable()
export class ProcurementOrderQueryService {
  constructor(
    @InjectRepository(ProcurementOrder)
    private readonly headers: Repository<ProcurementOrder>,
    @InjectRepository(ProcurementOrderLine)
    private readonly lines: Repository<ProcurementOrderLine>,
    @InjectRepository(ProcurementOrderAcceptance)
    private readonly acceptances: Repository<ProcurementOrderAcceptance>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
  ) {}

  /** Nhật ký duyệt của một đơn mua, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async list(page: number, pageSize: number) {
    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :notDeleted', { notDeleted: false })
      .orderBy('h.createdAt', 'DESC');
    // Tổng tính trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await computeTableSummaries(qb, SUMMARY_COLUMNS);
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { rows, total, page, pageSize, summaries };
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
