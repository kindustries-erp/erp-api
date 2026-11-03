import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BaseGoodsReceiptEntity } from '@/v2/core/goods-receipts/entities/base-goods-receipt.entity';
import type { GarageGoodsReceiptLine } from './garage-goods-receipt-line.entity';

@Entity('erp_garage_goods_receipts')
export class GarageGoodsReceipt extends BaseGoodsReceiptEntity {
  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: 'UNPAID',
    name: 'payment_status',
  })
  paymentStatus: string;

  @OneToMany('GarageGoodsReceiptLine', (line: any) => line.receipt, {
    cascade: true,
  })
  lines?: Relation<GarageGoodsReceiptLine[]>;
}
