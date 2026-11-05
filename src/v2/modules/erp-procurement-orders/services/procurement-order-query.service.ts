import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementOrder } from '../entities/procurement-order.entity';
import { ProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { ProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';

/** Mã loại chứng từ trong nhật ký duyệt. Khớp với docType của command. */
const DOC_TYPE = 'PROCUREMENT_ORDER';

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
    const [rows, total] = await this.headers.findAndCount({
      where: { isDeleted: false },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { rows, total, page, pageSize };
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
