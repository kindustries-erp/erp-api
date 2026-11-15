import { AiHubUsageLog } from '../entities/ai-hub-usage-log.entity';
import { AiHubUsageLogResponseDto } from '../dto/ai-hub-usage-log-response.dto';

/** Chuyển entity sang response DTO. Hàm thuần, không gọi DB. */
export function toAiHubUsageLogResponse(
  entity: AiHubUsageLog,
): AiHubUsageLogResponseDto {
  return {
    id: entity.id,
    extraData: entity.extraData ?? {},
    requestId: entity.requestId ?? undefined,
    actorUserId: entity.actorUserId ?? undefined,
    featureCode: entity.featureCode,
    tier: entity.tier,
    modelName: entity.modelName,
    promptTokens: entity.promptTokens ?? 0,
    completionTokens: entity.completionTokens ?? 0,
    totalTokens: entity.totalTokens ?? 0,
    latencyMs: entity.latencyMs ?? 0,
    outcome: entity.outcome,
    errorMessage: entity.errorMessage ?? undefined,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
