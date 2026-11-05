import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';
import { ApprovalEvent } from '@/v2/core/approval/entities/approval-event.entity';

/** Mã loại chứng từ của họ Garage trong nhật ký duyệt. Khớp với docType của command. */
const DOC_TYPE = 'GARAGE_PROCUREMENT_ORDER';

@Injectable()
export class GarageProcurementOrderQueryService {
  constructor(
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

  async list(page: number, pageSize: number, branchId?: string) {
    const [rows, total] = await this.headers.findAndCount({
      where: { isDeleted: false, ...(branchId ? { branchId } : {}) },
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
