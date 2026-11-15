import { ConfigService } from '@nestjs/config';
import { AiTierModels, parseTierModels } from '@/v2/core/ai-hub-core';

const DEFAULT_BASE_URL = 'https://9router.liouni.com/v1';

export interface AiGatewayConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  /** Model của từng tier, đọc từ env `NINE_ROUTER_TIER_MODELS`. */
  tierModels: AiTierModels;
}

/** Đọc cấu hình 9router từ env. Không có giá trị mặc định cho tên model. */
export function readAiGatewayConfig(config: ConfigService): AiGatewayConfig {
  return {
    baseUrl: (
      config.get<string>('NINE_ROUTER_BASE_URL') || DEFAULT_BASE_URL
    ).replace(/\/+$/, ''),
    apiKey: config.get<string>('NINE_ROUTER_API_KEY') || '',
    timeoutMs: positiveInt(config.get('NINE_ROUTER_TIMEOUT_MS'), 30_000),
    maxRetries: positiveInt(config.get('NINE_ROUTER_MAX_RETRIES'), 2, 0),
    tierModels: parseTierModels(config.get<string>('NINE_ROUTER_TIER_MODELS')),
  };
}

function positiveInt(value: unknown, fallback: number, min = 1): number {
  const num = Number(value);
  return Number.isInteger(num) && num >= min ? num : fallback;
}
