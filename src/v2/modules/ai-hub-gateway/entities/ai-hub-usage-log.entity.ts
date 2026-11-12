import { Column, Entity, Index } from 'typeorm';
import { CoreSoftDeletableEntity } from '@/v2/core/base-core';

/** Một dòng cho mỗi lần gọi model qua gateway. `extraData` giữ thông tin phụ (tên file, kích thước). */
@Entity('ai_hub_usage_logs')
@Index('IDX_ai_hub_usage_logs_feature_created', ['featureCode', 'createdAt'])
export class AiHubUsageLog extends CoreSoftDeletableEntity {
  @Column({ type: 'varchar', length: 128, name: 'request_id', nullable: true })
  requestId?: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'actor_user_id',
    nullable: true,
  })
  actorUserId?: string;

  @Column({ type: 'varchar', length: 64, name: 'feature_code' })
  featureCode: string;

  @Column({ type: 'varchar', length: 16, name: 'tier' })
  tier: string;

  @Column({ type: 'varchar', length: 128, name: 'model_name' })
  modelName: string;

  @Column({ type: 'integer', name: 'prompt_tokens', default: 0 })
  promptTokens: number;

  @Column({ type: 'integer', name: 'completion_tokens', default: 0 })
  completionTokens: number;

  @Column({ type: 'integer', name: 'total_tokens', default: 0 })
  totalTokens: number;

  @Column({ type: 'integer', name: 'latency_ms', default: 0 })
  latencyMs: number;

  /** `SUCCESS` hoặc `ERROR`. */
  @Column({ type: 'varchar', length: 16, name: 'outcome' })
  outcome: string;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage?: string;
}
