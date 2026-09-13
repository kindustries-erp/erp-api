import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ErpModuleCategory } from '../../module-config/entities/erp_module_category.entity';
import type { ErpEntityAttributeValue } from '../../module-config/entities/erp_entity_attribute_value.entity';

@Entity({ name: 'erp_boms' })
export class ErpBom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'bom_code' })
  bomCode: string;

  @Column({ type: 'varchar', length: 255, name: 'bom_name' })
  bomName: string;

  @Column({ type: 'uuid', name: 'finished_good_item_id', nullable: true })
  finishedGoodItemId: string | null;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @ManyToOne('ErpModuleCategory', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: ErpModuleCategory;

  @Column({ type: 'varchar', length: 255, name: 'version' })
  version: string;

  @Column({ type: 'varchar', length: 255, name: 'status', default: 'ACTIVE' })
  status: string;

  @Column({ type: 'date', name: 'effective_from', nullable: true })
  effectiveFrom: string | null;

  @Column({ type: 'date', name: 'effective_to', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'text', name: 'notes', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  attributeValues?: ErpEntityAttributeValue[];
  customAttributes?: Record<string, any>;
  attributes?: Record<string, any>;
}
