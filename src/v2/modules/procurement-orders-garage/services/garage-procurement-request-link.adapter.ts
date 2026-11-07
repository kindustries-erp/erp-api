import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GarageProcurementRequestOrderingService } from '@/v2/modules/procurement-requests-garage/services/garage-procurement-request-ordering.service';
import { isNewCashflowSource } from '@/v2/modules/cashflow-garage/cashflow-garage-source';
import {
  RequestLinkPort,
  RequestLineItem,
} from '@/v2/core/procurement-orders-core/services/request-link.port';
import { CashflowPurchaseOrderingService } from './cashflow-purchase-ordering.service';

export const GARAGE_PROCUREMENT_REQUEST_LINK = Symbol(
  'GARAGE_PROCUREMENT_REQUEST_LINK',
);

/**
 * Cài RequestLinkPort. Chọn nguồn theo CASHFLOW_GARAGE_SOURCE (task 3.14):
 * `new` đặt hàng trên cashflow_forecast_lines; mặc định giữ PR cũ.
 * Lõi PO không biết lõi PR hay lõi dự chi; mọi lựa chọn nằm ở đây.
 */
@Injectable()
export class GarageProcurementRequestLinkAdapter implements RequestLinkPort {
  constructor(
    private readonly legacy: GarageProcurementRequestOrderingService,
    private readonly cashflow: CashflowPurchaseOrderingService,
  ) {}

  reserve(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    return this.source().reserve(manager, requestId, items);
  }

  release(
    manager: EntityManager,
    requestId: string,
    items: RequestLineItem[],
  ): Promise<void> {
    return this.source().release(manager, requestId, items);
  }

  private source(): RequestLinkPort {
    return isNewCashflowSource() ? this.cashflow : this.legacy;
  }
}
