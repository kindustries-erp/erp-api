import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbstractAiDocumentAgentService,
  AiTier,
  resolveTier,
} from '@/v2/core/ai-hub-core';
import { AiGatewayClient } from '@/v2/modules/ai-hub-gateway/services/ai-gateway.client';
import {
  GarageInvoiceExtraction,
  normalizeGarageInvoice,
} from '../helpers/garage-invoice-extraction.helper';
import {
  GARAGE_INVOICE_SYSTEM_PROMPT,
  GARAGE_INVOICE_USER_PROMPT,
  GARAGE_PR_INVOICE_FEATURE,
} from '../prompts/garage-invoice.prompt';

/** Tier mặc định khi env `AI_HUB_GARAGE_INVOICE_TIER` không khai báo. */
const DEFAULT_TIER: AiTier = 'low';
/** Đọc một PDF nhỏ đã mất gần 1 phút, nên chờ lâu hơn mặc định 30 giây của gateway. */
const DEFAULT_TIMEOUT_MS = 120_000;
const MIN_TIMEOUT_MS = 5_000;

/** Đọc ảnh/PDF hóa đơn thành dữ liệu có cấu trúc qua gateway AI. */
@Injectable()
export class GarageInvoiceExtractService extends AbstractAiDocumentAgentService<GarageInvoiceExtraction> {
  protected readonly featureCode = GARAGE_PR_INVOICE_FEATURE;
  protected readonly systemPrompt = GARAGE_INVOICE_SYSTEM_PROMPT;
  protected readonly userPrompt = GARAGE_INVOICE_USER_PROMPT;
  protected readonly maxTokens = 8192;

  constructor(
    gateway: AiGatewayClient,
    private readonly config: ConfigService,
  ) {
    super(gateway);
  }

  protected resolveTier(): AiTier {
    return resolveTier(
      this.config.get<string>('AI_HUB_GARAGE_INVOICE_TIER'),
      DEFAULT_TIER,
    );
  }

  protected resolveTimeoutMs(): number {
    const value = Number(
      this.config.get<string>('AI_HUB_GARAGE_INVOICE_TIMEOUT_MS'),
    );
    return Number.isInteger(value) && value >= MIN_TIMEOUT_MS
      ? value
      : DEFAULT_TIMEOUT_MS;
  }

  protected normalize(raw: Record<string, unknown>): GarageInvoiceExtraction {
    return normalizeGarageInvoice(raw);
  }
}
