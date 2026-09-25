import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_ai_configs' })
@Index('IDX_erp_ai_configs_module_code', ['moduleCode'], { unique: true })
@Index('IDX_erp_ai_configs_is_active', ['isActive'])
export class ErpAiConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'module_code' })
  moduleCode: string;

  @Column({ type: 'varchar', length: 255, name: 'module_name' })
  moduleName: string;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'tier_level',
    default: 'medium',
  })
  tierLevel: string; // 'low' | 'medium' | 'high' | 'ultra'

  @Column({
    type: 'varchar',
    length: 128,
    name: 'model_override',
    nullable: true,
  })
  modelOverride: string | null;

  @Column({ type: 'float', default: 0.2 })
  temperature: number;

  @Column({ type: 'integer', name: 'max_tokens', default: 4096 })
  maxTokens: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
