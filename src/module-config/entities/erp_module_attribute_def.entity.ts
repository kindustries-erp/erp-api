import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ErpModuleCategory } from './erp_module_category.entity';
import type { ErpEntityAttributeValue } from './erp_entity_attribute_value.entity';

export type BomAttributeFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'SELECT'
  | 'DATE'
  | 'CHECKBOX';

export type ModuleAttributeFieldType = BomAttributeFieldType;

export interface BomAttributeOption {
  value: string;
  label: string;
  labelEn?: string;
  labels?: {
    vi?: string;
    en?: string;
    [key: string]: string | undefined;
  };
}

export type ModuleAttributeOption = BomAttributeOption;

@Entity({ name: 'erp_module_attribute_defs' })
@Index(['categoryId', 'code'], { unique: true })
export class ErpModuleAttributeDef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @ManyToOne('ErpModuleCategory', 'attributeDefs', {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category?: ErpModuleCategory;

  @Column({ type: 'boolean', name: 'is_global', default: false })
  isGlobal: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'module_key_global',
    nullable: true,
  })
  moduleKeyGlobal: string | null;

  @Column({ type: 'varchar', length: 100, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'name_en', nullable: true })
  nameEn: string | null;

  @Column({ type: 'varchar', length: 50, name: 'field_type', default: 'TEXT' })
  fieldType: ModuleAttributeFieldType;

  @Column({ type: 'jsonb', name: 'options', nullable: true })
  options: ModuleAttributeOption[] | null;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', name: 'is_required', default: false })
  isRequired: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('ErpEntityAttributeValue', 'attrDef')
  attributeValues?: ErpEntityAttributeValue[];

  // Non-persistent computed field
  usageCount?: number;
}
