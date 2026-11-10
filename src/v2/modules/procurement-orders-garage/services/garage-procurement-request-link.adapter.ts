import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GarageProcurementRequestOrderingService } from '@/v2/modules/procurement-requests-garage/services/garage-procurement-request-ordering.service';
import {
  RequestLinkPort,
  RequestLineItem,
} from '@/v2/core/procurement-orders-core/services/request-link.port';

export const GARAGE_PROCUREMENT_REQUEST_LINK = Symbol(
  'GARAGE_PROCUREMENT_REQUEST_LINK',
);

/**
 * Cài RequestLinkPort bằng service PR thường. Đây là điểm nối duy nhất giữa
 * module PO thường và module PR thường; lõi PO không biết lõi PR.
 */
@Injectable()
export class GarageProcurementRequestLinkAdapter implements RequestLinkPort {
  constructor(
    private readonly ordering: GarageProcurementRequestOrderingService,
  ) {}

  reserve(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    return this.ordering.reserve(manager, requestId, items);
  }

  release(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    return this.ordering.release(manager, requestId, items);
  }
}
