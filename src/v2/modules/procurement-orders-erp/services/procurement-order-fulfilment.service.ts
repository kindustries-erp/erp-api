import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AbstractProcurementOrderFulfilmentService } from '@/v2/core/procurement-orders-core/services/abstract-procurement-order-fulfilment.service';
import { ProcurementOrder } from '../entities/procurement-order.entity';
import { ProcurementOrderLine } from '../entities/procurement-order-line.entity';
import { ProcurementOrderAcceptance } from '../entities/procurement-order-acceptance.entity';

@Injectable()
export class ProcurementOrderFulfilmentService extends AbstractProcurementOrderFulfilmentService<
  ProcurementOrder,
  ProcurementOrderLine,
  ProcurementOrderAcceptance
> {
  protected readonly headerEntity = ProcurementOrder;
  protected readonly lineEntity = ProcurementOrderLine;
  protected readonly acceptanceEntity = ProcurementOrderAcceptance;
  protected readonly lineForeignKey = 'orderId' as const;

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  protected acceptanceForeignKey(): string {
    return 'orderId';
  }
}
