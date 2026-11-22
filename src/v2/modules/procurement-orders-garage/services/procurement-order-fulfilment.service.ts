import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractProcurementOrderFulfilmentService } from '@/v2/core/procurement-orders-core/services/abstract-procurement-order-fulfilment.service';
import { GarageProcurementOrder } from '../entities/procurement-order.entity';
import { GarageProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { GarageProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';

@Injectable()
export class GarageProcurementOrderFulfilmentService extends AbstractProcurementOrderFulfilmentService<
  GarageProcurementOrder,
  GarageProcurementOrderLine,
  GarageProcurementOrderAcceptance
> {
  protected readonly headerEntity = GarageProcurementOrder;
  protected readonly lineEntity = GarageProcurementOrderLine;
  protected readonly acceptanceEntity = GarageProcurementOrderAcceptance;
  protected readonly lineForeignKey = 'orderId' as const;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  protected acceptanceForeignKey(): string {
    return 'orderId';
  }
}
