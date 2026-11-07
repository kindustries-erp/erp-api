import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Cột nền của sổ số dư tồn. Không gắn bảng: module sở hữu khai báo @Entity với tên bảng riêng
 * và truyền vào cấu hình ledger (StockLedgerConfig.tables).
 */
export abstract class BaseStockBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, name: 'ledger_scope' })
  ledgerScope: string;

  @Column({ type: 'uuid', nullable: true, name: 'branch_id' })
  branchId: string | null;

  @Column({ type: 'varchar', length: 128, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'varchar', length: 50, name: 'unit', default: 'Cái' })
  unit: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'qty_on_hand',
    default: 0,
  })
  qtyOnHand: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'inventory_value',
    default: 0,
  })
  inventoryValue: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    name: 'avg_cost',
    default: 0,
  })
  avgCost: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
