import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_TIERS,
  AiCompletionRequest,
  AiCompletionResult,
  AiGatewayPort,
} from '@/v2/core/ai-hub-core';
import {
  AiGatewayConfig,
  readAiGatewayConfig,
} from '../helpers/ai-gateway-config.helper';
import {
  AiGatewayHttpError,
  backoffMs,
  requestGatewayJson,
} from '../helpers/nine-router-http.helper';
import { AiUsageLogService } from './ai-usage-log.service';

interface ChatCompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Gọi model qua 9router theo tier. Model của từng tier lấy từ env `NINE_ROUTER_TIER_MODELS`;
 * tier có nhiều model thì model trước lỗi do nhà cung cấp sẽ chuyển sang model kế.
 */
@Injectable()
export class AiGatewayClient implements AiGatewayPort {
  private readonly logger = new Logger(AiGatewayClient.name);
  private readonly settings: AiGatewayConfig;

  constructor(
    config: ConfigService,
    private readonly usageLog: AiUsageLogService,
  ) {
    this.settings = readAiGatewayConfig(config);
    const missing = AI_TIERS.filter((tier) => !this.settings.tierModels[tier]);
    if (missing.length) {
      this.logger.warn(
        `NINE_ROUTER_TIER_MODELS thiếu tier: ${missing.join(', ')}`,
      );
    }
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const models = this.settings.tierModels[request.tier] ?? [];
    if (!models.length) {
      throw new ServiceUnavailableException(
        `Tier AI '${request.tier}' chưa được cấu hình trong NINE_ROUTER_TIER_MODELS`,
      );
    }
    const startedAt = Date.now();
    const log = {
      featureCode: request.featureCode,
      tier: request.tier,
      actorUserId: request.actorUserId,
      requestId: request.requestId,
      meta: request.meta,
    };
    let lastModel = models[0];
    try {
      const { data, model } = await this.tryModels(models, request, (m) => {
        lastModel = m;
      });
      const latencyMs = Date.now() - startedAt;
      const usage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      };
      // Ghi model đã cấu hình (data.model của 9router là tên nội bộ của nhà cung cấp)
      await this.usageLog.record({
        ...log,
        ...usage,
        modelName: model,
        outcome: 'SUCCESS',
        latencyMs,
      });
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        tier: request.tier,
        model,
        usage,
        latencyMs,
      };
    } catch (error) {
      const httpError = error as AiGatewayHttpError;
      await this.usageLog.record({
        ...log,
        modelName: lastModel,
        outcome: 'ERROR',
        latencyMs: Date.now() - startedAt,
        errorMessage: httpError.message,
      });
      const message = `Không gọi được AI (tier ${request.tier}, model ${lastModel}): ${httpError.message}`;
      throw httpError.kind === 'http'
        ? new BadGatewayException(message)
        : new GatewayTimeoutException(message);
    }
  }

  /** Thử lần lượt các model của tier; chỉ chuyển model khi lỗi đến từ model/nhà cung cấp. */
  private async tryModels(
    models: string[],
    request: AiCompletionRequest,
    onAttempt: (model: string) => void,
  ): Promise<{ data: ChatCompletionResponse; model: string }> {
    for (const [index, model] of models.entries()) {
      onAttempt(model);
      try {
        return { data: await this.postWithRetry(model, request), model };
      } catch (error) {
        const httpError = error as AiGatewayHttpError;
        const hasNext = index < models.length - 1;
        if (!hasNext || !httpError.canFallback) throw error;
        this.logger.warn(
          `Model ${model} lỗi (${httpError.message}), chuyển sang ${models[index + 1]}`,
        );
      }
    }
    throw new AiGatewayHttpError('Không có model nào để gọi', 'http', false);
  }

  private async postWithRetry(
    model: string,
    request: AiCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const { baseUrl, apiKey, maxRetries } = this.settings;
    for (let attempt = 0; ; attempt++) {
      try {
        return await requestGatewayJson<ChatCompletionResponse>({
          url: `${baseUrl}/chat/completions`,
          apiKey,
          timeoutMs: request.timeoutMs ?? this.settings.timeoutMs,
          body: {
            model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            // 9router mặc định trả stream; client này chỉ đọc JSON
            stream: false,
          },
        });
      } catch (error) {
        const httpError = error as AiGatewayHttpError;
        if (!httpError.retryable || attempt >= maxRetries) throw error;
        this.logger.warn(
          `9router (${model}) lỗi lần ${attempt + 1}/${maxRetries + 1}: ${httpError.message}`,
        );
        await this.wait(backoffMs(attempt, httpError.retryAfterMs));
      }
    }
  }

  /** Tách riêng để spec thay thế, không phải chờ thật. */
  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
