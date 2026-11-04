import {
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  type Relation,
} from 'typeorm';
import { BasePurchaseOrderEntity } from '@/v2/core/purchase-orders/entities/base-purchase-order.entity';
import { ErpBusinessPartner } from '@/v2/business-partners-core/entities/erp_business_partner.entity';
import type { PurchaseOrderLine } from './purchase-order-line.entity';

/**
 * Entity v2 trỏ CÙNG bảng erp_purchase_orders với ErpPurchaseOrder (v1).
 * Không DDL, không migration. Tên class khác v1 để TypeORM không trùng đăng ký.
 */
@Entity('erp_purchase_orders')
export class PurchaseOrder extends BasePurchaseOrderEntity {
  @ManyToOne(() => ErpBusinessPartner)
  @JoinColumn({ name: 'supplier_id' })
  supplier?: Relation<ErpBusinessPartner>;

  @OneToMany('PurchaseOrderLine', (line: any) => line.purchaseOrder)
  lines?: Relation<PurchaseOrderLine[]>;
}
