import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { AbstractProcurementOrderCommandService } from '@/v2/core/procurement-orders/services/abstract-procurement-order-command.service';
import type { RequestLinkPort } from '@/v2/core/procurement-orders/services/request-link.port';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { GARAGE_PROCUREMENT_REQUEST_LINK } from './garage-procurement-request-link.adapter';

@Injectable()
export class GarageProcurementOrderCommandService extends AbstractProcurementOrderCommandService<
  GarageProcurementOrder,
  GarageProcurementOrderLine
> {
  protected readonly headerEntity = GarageProcurementOrder;
  protected readonly lineEntity = GarageProcurementOrderLine;
  protected readonly lineForeignKey = 'orderId' as const;
  protected readonly docType = 'GARAGE_PROCUREMENT_ORDER';
  protected readonly numberPrefix = 'GDMH';

  constructor(
    dataSource: DataSource,
    events: ApprovalEventService,
    @Inject(GARAGE_PROCUREMENT_REQUEST_LINK) link: RequestLinkPort,
  ) {
    super(dataSource, events, link);
  }
}
