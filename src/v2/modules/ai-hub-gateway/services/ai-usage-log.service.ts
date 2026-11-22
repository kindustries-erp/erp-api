import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiHubUsageLog } from '../entities/ai-hub-usage-log.entity';

export interface AiUsageLogInput {
  featureCode: string;
  tier: string;
  modelName: string;
  outcome: 'SUCCESS' | 'ERROR';
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  errorMessage?: string;
  actorUserId?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
}

/** Ghi usage của từng lần gọi model. Lỗi ghi log không làm hỏng lần gọi AI. */
@Injectable()
export class AiUsageLogService {
  private readonly logger = new Logger(AiUsageLogService.name);

  constructor(
    @InjectRepository(AiHubUsageLog)
    private readonly repo: Repository<AiHubUsageLog>,
  ) {}

  async record(input: AiUsageLogInput): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          featureCode: input.featureCode,
          tier: input.tier,
          modelName: input.modelName,
          outcome: input.outcome,
          latencyMs: Math.round(input.latencyMs),
          promptTokens: input.promptTokens ?? 0,
          completionTokens: input.completionTokens ?? 0,
          totalTokens: input.totalTokens ?? 0,
          errorMessage: input.errorMessage?.slice(0, 2000),
          actorUserId: input.actorUserId,
          requestId: input.requestId,
          extraData: input.meta ?? {},
          isDeleted: false,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Không ghi được usage log (${input.featureCode}): ${(error as Error).message}`,
      );
    }
  }
}
