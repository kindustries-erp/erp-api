import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_balances_garage')
export class GarageInventoryBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', name: 'branch_id', nullable: true })
  branchId?: string | null;

  @Index()
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
    name: 'avg_cost',
    default: 0,
  })
  avgCost: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
