import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestLine } from '../entities/procurement-request-line.entity';
import { ApprovalEvent } from '@/v2/core/approval-core/entities/approval-event.entity';
import { PURCHASE_REQUEST_DOC_TYPE } from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import {
  applyListSummaries,
  parseSummaryKeys,
  TableSummaryColumn,
} from '@/common/utils/table-query';

/** Cột số được cộng vào `summaries` của danh sách PR erp. */
const SUMMARY_COLUMNS: TableSummaryColumn[] = [
  { key: 'estimatedTotal', sql: 'h.estimatedTotal' },
];

@Injectable()
export class ProcurementRequestQueryService {
  constructor(
    @InjectRepository(ProcurementRequest)
    private readonly headers: Repository<ProcurementRequest>,
    @InjectRepository(ProcurementRequestLine)
    private readonly lines: Repository<ProcurementRequestLine>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
  ) {}

  /** Nhật ký duyệt của một đề nghị, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: PURCHASE_REQUEST_DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async list(page: number, pageSize: number, summaryKeys?: string) {
    const qb = this.headers
      .createQueryBuilder('h')
      .where('h.isDeleted = :notDeleted', { notDeleted: false })
      .orderBy('h.createdAt', 'DESC')
      .addOrderBy('h.id', 'ASC');
    // Tổng theo summary_keys trên toàn bộ dòng khớp, nên phải gọi trước khi phân trang
    const summaries = await applyListSummaries(qb, {
      columns: SUMMARY_COLUMNS,
      keys: parseSummaryKeys(summaryKeys),
      page,
      pageSize,
      tieBreaker: 'h.id',
    });
    const [rows, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { rows, total, page, pageSize, summaries };
  }

  async findOne(
    id: string,
  ): Promise<{ header: ProcurementRequest; lines: ProcurementRequestLine[] }> {
    const header = await this.headers.findOne({
      where: { id, isDeleted: false },
    });
    if (!header) throw new NotFoundException('Không tìm thấy đề nghị mua');
    const lines = await this.lines.find({
      where: { requestId: id },
      order: { lineNo: 'ASC' },
    });
    return { header, lines };
  }
}
