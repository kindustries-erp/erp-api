import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { AbstractProcurementOrderCommandService } from '@/v2/core/procurement-orders/services/abstract-procurement-order-command.service';
import type { RequestLinkPort } from '@/v2/core/procurement-orders/services/request-link.port';
import { ProcurementOrder } from '../entities/procurement-order.entity';
import { ProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { PROCUREMENT_REQUEST_LINK } from './procurement-request-link.adapter';

@Injectable()
export class ProcurementOrderCommandService extends AbstractProcurementOrderCommandService<
  ProcurementOrder,
  ProcurementOrderLine
> {
  protected readonly headerEntity = ProcurementOrder;
  protected readonly lineEntity = ProcurementOrderLine;
  protected readonly lineForeignKey = 'orderId' as const;
  protected readonly docType = 'PROCUREMENT_ORDER';
  protected readonly numberPrefix = 'DMH';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    @Inject(PROCUREMENT_REQUEST_LINK) link: RequestLinkPort,
  ) {
    super(dataSource, events, link);
  }
}
