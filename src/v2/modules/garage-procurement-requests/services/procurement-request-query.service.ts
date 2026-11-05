import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';

/** Mã loại chứng từ của họ Garage trong nhật ký duyệt. Khớp với docType của command. */
const GARAGE_PURCHASE_REQUEST_DOC_TYPE = 'GARAGE_PROCUREMENT_REQUEST';

@Injectable()
export class GarageProcurementRequestQueryService {
  constructor(
    @InjectRepository(GarageProcurementRequest)
    private readonly headers: Repository<GarageProcurementRequest>,
    @InjectRepository(GarageProcurementRequestLine)
    private readonly lines: Repository<GarageProcurementRequestLine>,
    @InjectRepository(ApprovalEvent)
    private readonly events: Repository<ApprovalEvent>,
  ) {}

  /** Nhật ký duyệt của một đề nghị Garage, theo thứ tự thời gian. */
  async approvalEvents(id: string): Promise<ApprovalEvent[]> {
    return this.events.find({
      where: { docType: GARAGE_PURCHASE_REQUEST_DOC_TYPE, docId: id },
      order: { createdAt: 'ASC' },
    });
  }

  async list(page: number, pageSize: number, branchId?: string) {
    const [rows, total] = await this.headers.findAndCount({
      where: { isDeleted: false, ...(branchId ? { branchId } : {}) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { rows, total, page, pageSize };
  }

  async findOne(id: string): Promise<{
    header: GarageProcurementRequest;
    lines: GarageProcurementRequestLine[];
  }> {
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
