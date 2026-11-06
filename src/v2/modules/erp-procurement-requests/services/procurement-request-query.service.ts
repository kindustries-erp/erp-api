import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestLine } from '../entities/procurement-request-line.entity';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';
import { PURCHASE_REQUEST_DOC_TYPE } from '@/v2/core/procurement-requests/contracts/procurement-requests.contract';

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

  async list(page: number, pageSize: number) {
    const [rows, total] = await this.headers.findAndCount({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { rows, total, page, pageSize };
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
