import { Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Cột nền của lớp giá FIFO. Tổng qtyRemaining của các lớp = qtyOnHand của số dư.
 * Module sở hữu khai báo bảng (xem BaseStockBalanceEntity).
 */
export abstract class BaseStockCostLayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, name: 'ledger_scope' })
  ledgerScope: string;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, name: 'qty_remaining' })
  qtyRemaining: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, name: 'unit_cost' })
  unitCost: string;

  @Column({ type: 'timestamptz', name: 'received_at' })
  receivedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
