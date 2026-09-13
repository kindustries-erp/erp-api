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
import { ErpModuleCategory } from './erp_module_category.entity';
import { ErpModuleAttributeDef } from './erp_module_attribute_def.entity';

@Entity({ name: 'erp_entity_attribute_values' })
@Index(['entityType', 'entityId', 'attrDefId'], { unique: true })
@Index(['entityType', 'entityId'])
@Index(['attrDefId'])
export class ErpEntityAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'entity_type' })
  entityType: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ErpModuleCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ErpModuleCategory | null;

  @Column({ type: 'uuid', name: 'attr_def_id' })
  attrDefId: string;

  @ManyToOne(() => ErpModuleAttributeDef, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attr_def_id' })
  attrDef: ErpModuleAttributeDef;

  @Column({ type: 'text', name: 'value_text', nullable: true })
  valueText: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
