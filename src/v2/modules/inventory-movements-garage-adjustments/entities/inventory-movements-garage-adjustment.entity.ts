import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BaseStockVoucherEntity } from '@/v2/core/inventory-movements-core';
import type { InventoryMovementsGarageAdjustmentLine } from './inventory-movements-garage-adjustment-line.entity';

/** Phiếu điều chỉnh kho Garage. Số dư tăng hoặc giảm theo chiều của từng dòng khi ghi sổ. */
@Entity('garage_stock_adjustments')
export class InventoryMovementsGarageAdjustment extends BaseStockVoucherEntity {
  @Index('ux_garage_stock_adjustments_voucher_no', { unique: true })
  @Column({ type: 'varchar', length: 64, name: 'voucher_no' })
  voucherNo: string;

  @Column({ type: 'timestamptz', name: 'voucher_date' })
  voucherDate: Date;

  @Index()
  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'partner_name',
    nullable: true,
  })
  partnerName: string | null;

  @Column({ type: 'text', name: 'remarks', nullable: true })
  remarks: string | null;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'total_amount',
    default: 0,
  })
  totalAmount: string;

  @OneToMany(
    'InventoryMovementsGarageAdjustmentLine',
    (line: any) => line.voucher,
    {
      cascade: true,
    },
  )
  lines?: Relation<InventoryMovementsGarageAdjustmentLine[]>;
}
