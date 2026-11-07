import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  type Relation,
} from 'typeorm';
import { BaseStockVoucherLineEntity } from '@/v2/core/inventory-movements-core';
import type { InventoryMovementsGarageIssue } from './inventory-movements-garage-issue.entity';

@Entity('garage_stock_issue_lines')
export class InventoryMovementsGarageIssueLine extends BaseStockVoucherLineEntity {
  @Index()
  @Column({ type: 'uuid', name: 'voucher_id' })
  voucherId: string;

  @ManyToOne('InventoryMovementsGarageIssue', (voucher: any) => voucher.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'voucher_id' })
  voucher?: Relation<InventoryMovementsGarageIssue>;
}
