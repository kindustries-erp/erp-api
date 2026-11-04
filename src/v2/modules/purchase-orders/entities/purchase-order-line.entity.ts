import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BasePurchaseOrderLineEntity } from '@/v2/core/purchase-orders/entities/base-purchase-order-line.entity';
import type { PurchaseOrder } from './purchase-order.entity';

/** Trỏ cùng bảng erp_purchase_order_lines với ErpPurchaseOrderLine (v1). */
@Entity('erp_purchase_order_lines')
export class PurchaseOrderLine extends BasePurchaseOrderLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'purchase_order_id' })
  purchaseOrderId: string;

  // Không khai báo onDelete: FK thật trên DB là NO ACTION (đã kiểm tra).
  @ManyToOne('PurchaseOrder', (po: any) => po.lines)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: Relation<PurchaseOrder>;
}
