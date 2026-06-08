import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_inventory_balances' })
export class ErpInventoryBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'item_id', nullable: true })
  itemId: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'warehouse_code',
    nullable: true,
  })
  warehouseCode: string | null;

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
    scale: 3,
    name: 'qty_reserved',
    default: 0,
  })
  qtyReserved: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'avg_unit_cost',
    default: 0,
  })
  avgUnitCost: string;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 3,
    name: 'inventory_value',
    default: 0,
  })
  inventoryValue: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
