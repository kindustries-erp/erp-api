import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseGoodsReceiptLineEntity } from '@/v2/core/goods-receipts-core/entities/base-goods-receipt-line.entity';
import type { GarageGoodsReceipt } from './garage-goods-receipt.entity';

@Entity('erp_garage_goods_receipt_lines')
export class GarageGoodsReceiptLine extends BaseGoodsReceiptLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'garage_goods_receipt_id' })
  garageGoodsReceiptId: string;

  /** Dòng đơn mua garage được nhận; bắt buộc khi phiếu thuộc một đơn mua. */
  @Index()
  @Column({
    type: 'uuid',
    name: 'procurement_order_line_id',
    nullable: true,
  })
  procurementOrderLineId?: string | null;

  @ManyToOne('GarageGoodsReceipt', (receipt: any) => receipt.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'garage_goods_receipt_id' })
  receipt?: Relation<GarageGoodsReceipt>;
}
