import { Injectable } from '@nestjs/common';
import { AbstractPurchaseRequestOrderingService } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-ordering.service';
import { ProcurementRequest } from '../entities/procurement-request.entity';
import { ProcurementRequestLine } from '../entities/procurement-request-line.entity';

/** Cổng đặt hàng của module PR thường. PO thường gọi qua RequestLinkPort. */
@Injectable()
export class ProcurementRequestOrderingService extends AbstractPurchaseRequestOrderingService<
  ProcurementRequest,
  ProcurementRequestLine
> {
  protected readonly headerEntity = ProcurementRequest;
  protected readonly lineEntity = ProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
}
