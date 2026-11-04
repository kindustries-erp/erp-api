import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BasePurchaseOrderEntity } from '@/v2/core/purchase-orders/entities/base-purchase-order.entity';
import type { GaragePurchaseOrderLine } from './garage-purchase-order-line.entity';

@Entity('erp_garage_purchase_orders')
export class GaragePurchaseOrder extends BasePurchaseOrderEntity {
  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'branch_name', nullable: true })
  branchName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'supplier_name',
    nullable: true,
  })
  supplierName: string | null;

  /** Chỉ module garage ghi cột này (hook onLinesPersisted). */
  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  @OneToMany('GaragePurchaseOrderLine', (line: any) => line.purchaseOrder, {
    cascade: true,
  })
  lines?: Relation<GaragePurchaseOrderLine[]>;
}
