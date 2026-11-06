import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval-core/approval-event.service';
import { AbstractPurchaseRequestCommandService } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-command.service';
import { GarageProcurementOrder } from '@/v2/modules/procurement-orders-garage/entities/procurement-order.entity';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';

@Injectable()
export class GarageProcurementRequestCommandService extends AbstractPurchaseRequestCommandService<
  GarageProcurementRequest,
  GarageProcurementRequestLine
> {
  protected readonly headerEntity = GarageProcurementRequest;
  protected readonly lineEntity = GarageProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'GARAGE_PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'GDNM';

  constructor(dataSource: DataSource, events: ApprovalEventService) {
    super(dataSource, events);
  }

  /** Đơn mua garage (kể cả đã xóa mềm) giữ khóa ngoại RESTRICT tới đề nghị. */
  protected async assertNoDependentOrders(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const count = await manager.count(GarageProcurementOrder, {
      where: { requestId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'Không xóa cứng được đề nghị đã có đơn mua tham chiếu',
      );
    }
  }
}
