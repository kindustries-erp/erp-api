import { Column, Entity, Index } from 'typeorm';
import { BaseProcurementOrderLineEntity } from '@/v2/core/procurement-orders-core/entities/base-procurement-order-line.entity';

@Entity('proc_order_lines_garage')
export class GarageProcurementOrderLine extends BaseProcurementOrderLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;
}
