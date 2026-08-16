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
import { ErpBom } from '../../bom-core/entities/erp_bom.entity';
import { ErpBomAttributeDef } from './erp_bom_attribute_def.entity';

@Entity({ name: 'erp_bom_attribute_values' })
@Index(['bomId', 'attrDefId'], { unique: true })
export class ErpBomAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'bom_id' })
  bomId: string;

  @ManyToOne(() => ErpBom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bom_id' })
  bom?: ErpBom;

  @Column({ type: 'uuid', name: 'attr_def_id' })
  attrDefId: string;

  @ManyToOne(() => ErpBomAttributeDef, (def) => def.attributeValues, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'attr_def_id' })
  attrDef?: ErpBomAttributeDef;

  @Column({ type: 'text', name: 'value_text', nullable: true })
  valueText: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
