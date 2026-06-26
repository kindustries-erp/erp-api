import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ErpUom } from './erp_uom.entity';
import { ErpItemType } from './erp_item_type.entity';

@Entity({ name: 'erp_inventory_items' })
export class ErpInventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'sku' })
  sku: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'uuid', name: 'uom_id' })
  uomId: string;

  @ManyToOne(() => ErpUom)
  @JoinColumn({ name: 'uom_id' })
  uom: ErpUom;

  @Column({ type: 'uuid', name: 'item_type_id' })
  itemTypeId: string;

  @ManyToOne(() => ErpItemType)
  @JoinColumn({ name: 'item_type_id' })
  itemType: ErpItemType;

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
