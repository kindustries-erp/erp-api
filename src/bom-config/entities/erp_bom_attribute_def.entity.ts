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
import type { ErpBomCategory } from './erp_bom_category.entity';
import type { ErpBomAttributeValue } from './erp_bom_attribute_value.entity';

export type BomAttributeFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'SELECT'
  | 'DATE'
  | 'CHECKBOX';

export interface BomAttributeOption {
  label: string;
  value: string;
}

@Entity({ name: 'erp_bom_attribute_defs' })
@Index(['categoryId', 'code'], { unique: true })
export class ErpBomAttributeDef {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'category_id', nullable: true })
  categoryId: string | null;

  @ManyToOne('ErpBomCategory', 'attributeDefs', {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category?: ErpBomCategory;

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

  @Column({ type: 'varchar', length: 50, name: 'field_type', default: 'TEXT' })
  fieldType: BomAttributeFieldType;

  @Column({ type: 'jsonb', name: 'options', nullable: true })
  options: BomAttributeOption[] | null;

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

  @OneToMany('ErpBomAttributeValue', 'attrDef')
  attributeValues?: ErpBomAttributeValue[];

  // Non-persistent computed field
  usageCount?: number;
}
