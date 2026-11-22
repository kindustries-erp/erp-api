import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseStockVoucherLineEntity } from '@/v2/core/inventory-movements-core';
import type { InventoryMovementsGarageReceipt } from './inventory-movements-garage-receipt.entity';

@Entity('garage_stock_receipt_lines')
export class InventoryMovementsGarageReceiptLine extends BaseStockVoucherLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'voucher_id' })
  voucherId: string;

  @ManyToOne(
    'InventoryMovementsGarageReceipt',
    (receipt: any) => receipt.lines,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Relation<InventoryMovementsGarageReceipt>;
}
