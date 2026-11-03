import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseGoodsReceiptLineEntity } from '@/v2/core/goods-receipts/entities/base-goods-receipt-line.entity';
import type { GarageGoodsReceipt } from './garage-goods-receipt.entity';

@Entity('erp_garage_goods_receipt_lines')
export class GarageGoodsReceiptLine extends BaseGoodsReceiptLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'garage_goods_receipt_id' })
  garageGoodsReceiptId: string;

  @ManyToOne('GarageGoodsReceipt', (receipt: any) => receipt.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'garage_goods_receipt_id' })
  receipt?: Relation<GarageGoodsReceipt>;
}
