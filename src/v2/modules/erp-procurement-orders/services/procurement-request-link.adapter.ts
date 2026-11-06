import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProcurementRequestOrderingService } from '@/v2/modules/erp-procurement-requests/services/procurement-request-ordering.service';
import {
  RequestLinkPort,
  RequestLineItem,
} from '@/v2/core/procurement-orders/services/request-link.port';

export const PROCUREMENT_REQUEST_LINK = Symbol('PROCUREMENT_REQUEST_LINK');

/**
 * Cài RequestLinkPort bằng service PR thường. Đây là điểm nối duy nhất giữa
 * module PO thường và module PR thường; lõi PO không biết lõi PR.
 */
@Injectable()
export class ProcurementRequestLinkAdapter implements RequestLinkPort {
  constructor(private readonly ordering: ProcurementRequestOrderingService) {}

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
