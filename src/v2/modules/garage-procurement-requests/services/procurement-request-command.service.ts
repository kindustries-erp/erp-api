import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { AbstractPurchaseRequestCommandService } from '@/v2/core/procurement-requests/services/abstract-purchase-request-command.service';
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
}
