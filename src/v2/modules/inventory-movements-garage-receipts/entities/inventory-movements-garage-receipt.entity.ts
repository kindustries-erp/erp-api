import { Column, Entity, Index, OneToMany, type Relation } from 'typeorm';
import { BaseStockVoucherEntity } from '@/v2/core/inventory-movements-core';
import type { InventoryMovementsGarageReceiptLine } from './inventory-movements-garage-receipt-line.entity';

/** Phiếu nhập kho Garage. Số dư nhập được ghi vào sổ tồn GARAGE khi ghi sổ. */
@Entity('garage_stock_receipts')
export class InventoryMovementsGarageReceipt extends BaseStockVoucherEntity {
  @Index('ux_garage_stock_receipts_voucher_no', { unique: true })
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
    'InventoryMovementsGarageReceiptLine',
    (line: any) => line.voucher,
    {
      cascade: true,
    },
  )
  lines?: Relation<InventoryMovementsGarageReceiptLine[]>;
}
