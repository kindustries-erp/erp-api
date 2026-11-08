import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BaseGoodsReceiptEntity } from '@/v2/core/goods-receipts-core/entities/base-goods-receipt.entity';
import type { GarageGoodsReceiptLine } from './garage-goods-receipt-line.entity';

@Entity('goods_receipts_garage')
export class GarageGoodsReceipt extends BaseGoodsReceiptEntity {
  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: 'UNPAID',
    name: 'payment_status',
  })
  paymentStatus: string;

  /** Đơn mua garage nguồn; null khi nhập không qua PO. */
  @Index()
  @Column({
    type: 'uuid',
    name: 'garage_procurement_order_id',
    nullable: true,
  })
  garageProcurementOrderId?: string | null;

  @OneToMany('GarageGoodsReceiptLine', (line: any) => line.receipt, {
    cascade: true,
  })
  lines?: Relation<GarageGoodsReceiptLine[]>;
}
