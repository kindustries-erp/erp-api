import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BasePurchaseOrderLineEntity } from '@/v2/core/purchase-orders/entities/base-purchase-order-line.entity';
import type { GaragePurchaseOrder } from './garage-purchase-order.entity';

@Entity('erp_garage_purchase_order_lines')
export class GaragePurchaseOrderLine extends BasePurchaseOrderLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'garage_purchase_order_id' })
  garagePurchaseOrderId: string;

  @ManyToOne('GaragePurchaseOrder', (po: any) => po.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'garage_purchase_order_id' })
  purchaseOrder?: Relation<GaragePurchaseOrder>;
}
