import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { GarageGoodsReceipt } from '@/v2/modules/garage-goods-receipts/entities/garage-goods-receipt.entity';
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

  /** Phiếu nhập garage (kể cả đã hủy) giữ khóa ngoại RESTRICT tới đơn mua. */
  protected async assertNoDependentReceipts(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const count = await manager.count(GarageGoodsReceipt, {
      where: { garageProcurementOrderId: id },
    });
    if (count > 0) {
      throw new ConflictException(
        'Không xóa cứng được đơn mua đã có phiếu nhập tham chiếu',
      );
    }
  }
}
