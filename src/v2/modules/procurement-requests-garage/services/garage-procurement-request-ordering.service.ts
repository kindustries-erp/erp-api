import { Injectable } from '@nestjs/common';
import { AbstractPurchaseRequestOrderingService } from '@/v2/core/procurement-requests-core/services/abstract-purchase-request-ordering.service';
import { GarageProcurementRequest } from '../entities/procurement-request.entity';
import { GarageProcurementRequestLine } from '../entities/procurement-request-line.entity';

/** Cổng đặt hàng của module PR thường. PO thường gọi qua RequestLinkPort. */
@Injectable()
export class GarageProcurementRequestOrderingService extends AbstractPurchaseRequestOrderingService<
  GarageProcurementRequest,
  GarageProcurementRequestLine
> {
  protected readonly headerEntity = GarageProcurementRequest;
  protected readonly lineEntity = GarageProcurementRequestLine;
  protected readonly lineForeignKey = 'requestId' as const;
}
