import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalEventService } from '@/v2/core/approval/approval-event.service';
import { AbstractPurchaseRequestCommandService } from '@/v2/core/procurement-requests/services/abstract-purchase-request-command.service';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestLine } from '../entities/procurement-request-line.entity';

@Injectable()
export class ProcurementRequestCommandService extends AbstractPurchaseRequestCommandService<
  ProcurementRequest,
  ProcurementRequestLine
> {
  protected readonly headerEntity = ProcurementRequest;
  protected readonly lineEntity = ProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
  protected readonly docType = 'PROCUREMENT_REQUEST';
  protected readonly numberPrefix = 'DNM';

  constructor(dataSource: DataSource, events: ApprovalEventService) {
    super(dataSource, events);
  }
}
