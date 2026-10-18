import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'erp_ai_prompt_templates' })
@Index('IDX_erp_ai_prompt_templates_code_ver', ['templateCode', 'version'], {
  unique: true,
})
@Index('IDX_erp_ai_prompt_templates_module', ['moduleCode'])
export class ErpAiPromptTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, name: 'template_code' })
  templateCode: string;

  @Column({ type: 'varchar', length: 64, name: 'module_code' })
  moduleCode: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt: string;

  @Column({ type: 'text', name: 'user_prompt_template' })
  userPromptTemplate: string;

  @Column({ type: 'jsonb', name: 'input_schema_json', nullable: true })
  inputSchemaJson: Record<string, unknown> | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
