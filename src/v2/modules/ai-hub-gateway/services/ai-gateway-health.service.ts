import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiGatewayConfig,
  readAiGatewayConfig,
} from '../helpers/ai-gateway-config.helper';
import { requestGatewayJson } from '../helpers/nine-router-http.helper';
import { AiGatewayHealthDto } from '../dto/ai-gateway-health.dto';

/** Kiểm tra kết nối tới 9router và cho biết tier nào đã có model. */
@Injectable()
export class AiGatewayHealthService {
  private readonly settings: AiGatewayConfig;

  constructor(config: ConfigService) {
    this.settings = readAiGatewayConfig(config);
  }

  async check(): Promise<AiGatewayHealthDto> {
    const startedAt = Date.now();
    const base = {
      hasApiKey: !!this.settings.apiKey,
      tiers: { ...this.settings.tierModels },
    };
    try {
      const data = await requestGatewayJson<{ data?: unknown[] }>({
        url: `${this.settings.baseUrl}/models`,
        apiKey: this.settings.apiKey,
        timeoutMs: 10_000,
        method: 'GET',
      });
      return {
        ...base,
        ok: true,
        latencyMs: Date.now() - startedAt,
        modelsCount: data.data?.length ?? 0,
      };
    } catch (error) {
      return {
        ...base,
        ok: false,
        latencyMs: Date.now() - startedAt,
        modelsCount: 0,
        message: (error as Error).message,
      };
    }
  }
}
