import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_inventory_items' })
export class ErpInventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'sku' })
  sku: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'varchar', length: 255, name: 'uom' })
  uom: string;

  @Column({ type: 'varchar', length: 255, name: 'item_type' })
  itemType: string;

  @Column({ type: 'text', name: 'note', nullable: true })
  note?: string;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'tracking_policy',
    default: 'NONE',
  })
  trackingPolicy: 'NONE' | 'SERIAL' | 'LOT' | 'VEHICLE' | 'CUSTOM';

  @Column({
    type: 'varchar',
    length: 100,
    name: 'tracking_category_key',
    nullable: true,
  })
  trackingCategoryKey: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
