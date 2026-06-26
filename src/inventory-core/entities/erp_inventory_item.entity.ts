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
import { ErpTrackingPolicy } from './erp_tracking_policy.entity';
import { ErpTrackingCategory } from './erp_tracking_category.entity';

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

  /** FK → erp_tracking_policies.id */
  @Column({ type: 'uuid', name: 'tracking_policy_id', nullable: true })
  trackingPolicyId: string | null;

  @ManyToOne(() => ErpTrackingPolicy, { nullable: true, eager: false })
  @JoinColumn({ name: 'tracking_policy_id' })
  trackingPolicy: ErpTrackingPolicy | null;

  /** FK → erp_tracking_categories.id */
  @Column({ type: 'uuid', name: 'tracking_category_id', nullable: true })
  trackingCategoryId: string | null;

  @ManyToOne(() => ErpTrackingCategory, { nullable: true, eager: false })
  @JoinColumn({ name: 'tracking_category_id' })
  trackingCategory: ErpTrackingCategory | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
