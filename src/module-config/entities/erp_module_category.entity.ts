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
import type { ErpModuleAttributeDef } from './erp_module_attribute_def.entity';
import { ErpChartOfAccount } from '../../accounting-core/entities/erp_chart_of_account.entity';

@Entity({ name: 'erp_module_categories' })
@Index(['moduleKey', 'code'], { unique: true })
export class ErpModuleCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'module_key', default: 'BOM' })
  moduleKey: string;

  @Column({ type: 'varchar', length: 100, name: 'code' })
  code: string;

  @Column({ type: 'varchar', length: 255, name: 'name' })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'name_en', nullable: true })
  nameEn: string | null;

  @Column({ type: 'text', name: 'description', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', name: 'default_debit_account_id', nullable: true })
  defaultDebitAccountId: string | null;

  @ManyToOne(() => ErpChartOfAccount, { nullable: true, eager: false })
  @JoinColumn({ name: 'default_debit_account_id' })
  defaultDebitAccount: ErpChartOfAccount | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany('ErpModuleAttributeDef', 'category')
  attributeDefs?: ErpModuleAttributeDef[];
}
