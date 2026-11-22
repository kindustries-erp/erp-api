import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseStockVoucherLineEntity } from '@/v2/core/inventory-movements-core';
import type { InventoryMovementsGarageAdjustment } from './inventory-movements-garage-adjustment.entity';

@Entity('garage_stock_adjustment_lines')
export class InventoryMovementsGarageAdjustmentLine extends BaseStockVoucherLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'voucher_id' })
  voucherId: string;

  @ManyToOne(
    'InventoryMovementsGarageAdjustment',
    (voucher: any) => voucher.lines,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Relation<InventoryMovementsGarageAdjustment>;
}
