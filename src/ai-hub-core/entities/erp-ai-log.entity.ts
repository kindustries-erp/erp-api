import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'erp_ai_logs' })
@Index('IDX_erp_ai_logs_created_at', ['createdAt'])
@Index('IDX_erp_ai_logs_module_created', ['moduleCode', 'createdAt'])
@Index('IDX_erp_ai_logs_actor_created', ['actorUserId', 'createdAt'])
@Index('IDX_erp_ai_logs_status', ['status'])
export class ErpAiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128, name: 'request_id', nullable: true })
  requestId: string | null;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 255, name: 'actor_email', nullable: true })
  actorEmail: string | null;

  @Column({ type: 'varchar', length: 64, name: 'module_code' })
  moduleCode: string;

  @Column({ type: 'varchar', length: 32, name: 'tier_level' })
  tierLevel: string;

  @Column({ type: 'varchar', length: 128, name: 'model_name' })
  modelName: string;

  @Column({ type: 'text', name: 'prompt_snippet', nullable: true })
  promptSnippet: string | null;

  @Column({ type: 'integer', name: 'prompt_tokens', default: 0 })
  promptTokens: number;

  @Column({ type: 'integer', name: 'completion_tokens', default: 0 })
  completionTokens: number;

  @Column({ type: 'integer', name: 'total_tokens', default: 0 })
  totalTokens: number;

  @Column({ type: 'integer', name: 'latency_ms', default: 0 })
  latencyMs: number;

  @Column({ type: 'varchar', length: 32, default: 'SUCCESS' })
  status: string; // 'SUCCESS' | 'ERROR' | 'TIMEOUT'

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
