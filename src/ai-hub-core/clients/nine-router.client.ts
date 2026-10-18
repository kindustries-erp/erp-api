import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isRetryableStatus, NineRouterError } from './nine-router.error';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
} from './nine-router.types';

const TIER_NAMES = ['low', 'medium', 'high', 'ultra'] as const;
const HEALTH_PROBE_TIERS = ['low', 'medium', 'high'] as const;

export interface TierProbeResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const BACKOFF_JITTER_MS = 250;
const RETRY_AFTER_CAP_MS = 10000;

@Injectable()
export class NineRouterClient {
  private readonly logger = new Logger(NineRouterClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly tierModels: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService?.get<string>('NINE_ROUTER_BASE_URL') ||
      process.env.NINE_ROUTER_BASE_URL ||
      'https://9router.liouni.com/v1';

    this.apiKey =
      this.configService?.get<string>('NINE_ROUTER_API_KEY') ||
      process.env.NINE_ROUTER_API_KEY ||
      '';

    this.tierModels = this.parseTierModels(
      this.configService?.get<string>('NINE_ROUTER_TIER_MODELS') ||
        process.env.NINE_ROUTER_TIER_MODELS,
    );

    if (!this.apiKey) {
      this.logger.warn(
        'NINE_ROUTER_API_KEY chưa được cấu hình: mọi lời gọi tới 9router sẽ bị từ chối (401) và giải captcha sẽ dừng ngay.',
      );
    }

    this.timeoutMs = this.readPositiveInt(
      'NINE_ROUTER_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      1,
    );
    this.maxRetries = this.readPositiveInt(
      'NINE_ROUTER_MAX_RETRIES',
      DEFAULT_MAX_RETRIES,
      0,
    );
  }

  /**
   * Send a synchronous Chat Completion request to 9router.
   * Retries only transient failures (network, timeout, 408/425/429/5xx).
   */
  async complete(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const url = `${this.cleanBaseUrl()}/chat/completions`;
    const resolved = { ...request, model: this.resolveModel(request.model) };
    let lastError: NineRouterError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.postOnce(url, resolved);
      } catch (err: any) {
        const error = this.toNineRouterError(err);
        lastError = error;
        const canRetry = error.retryable && attempt < this.maxRetries;
        this.logger.warn(
          `9router attempt ${attempt + 1}/${this.maxRetries + 1} failed` +
            `${error.status ? ` (HTTP ${error.status})` : ''}: ${error.message}` +
            `${canRetry ? '' : ' - not retrying'}`,
        );
        if (!canRetry) break;
        await this.delay(this.backoffMs(attempt, error.retryAfterMs));
      }
    }

    throw (
      lastError ||
      new NineRouterError('9router request failed after retries', {
        retryable: false,
      })
    );
  }

  /**
   * Health check probe to verify connectivity to 9router.
   * `deep: true` gọi thử một request nhỏ cho từng tier (low/medium/high): `/models` vẫn OK ngay cả khi
   * tier trả 503 (vd thiếu credentials phía provider), nên chỉ health nông là chưa đủ.
   */
  async healthCheck(options: { deep?: boolean } = {}): Promise<{
    ok: boolean;
    latencyMs: number;
    modelsCount: number;
    hasApiKey: boolean;
    message?: string;
    tiers?: Record<string, TierProbeResult>;
  }> {
    const start = Date.now();
    const hasApiKey = !!this.apiKey;
    try {
      const url = `${this.cleanBaseUrl()}/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          modelsCount: 0,
          hasApiKey,
          message: `HTTP ${res.status} ${res.statusText}`,
        };
      }

      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      const base = { ok: true, latencyMs, modelsCount: count, hasApiKey };
      if (!options.deep) return base;

      const tiers = await this.probeTiers();
      const failed = Object.entries(tiers)
        .filter(([, t]) => !t.ok)
        .map(([name, t]) => `${name}: ${t.error ?? 'lỗi'}`);
      return {
        ...base,
        ok: failed.length === 0,
        tiers,
        ...(failed.length
          ? { message: `Tier lỗi - ${failed.join(' | ')}` }
          : {}),
      };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        modelsCount: 0,
        hasApiKey,
        message: err.message,
      };
    }
  }

  /** Gọi thử 1 completion tối đa 5 token cho từng tier, song song, không retry. */
  private async probeTiers(): Promise<Record<string, TierProbeResult>> {
    const url = `${this.cleanBaseUrl()}/chat/completions`;
    const entries = await Promise.all(
      HEALTH_PROBE_TIERS.map(
        async (tier): Promise<[string, TierProbeResult]> => {
          const model = this.resolveModel(tier);
          const t0 = Date.now();
          try {
            await this.postOnce(url, {
              model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5,
            });
            return [tier, { ok: true, model, latencyMs: Date.now() - t0 }];
          } catch (err: any) {
            const e = this.toNineRouterError(err);
            const detail = e.bodySnippet
              ? `${e.message} - ${e.bodySnippet}`
              : e.message;
            return [
              tier,
              {
                ok: false,
                model,
                latencyMs: Date.now() - t0,
                error: detail.slice(0, 200),
              },
            ];
          }
        },
      ),
    );
    return Object.fromEntries(entries);
  }

  /**
   * Thay tên tier (low/medium/high/ultra) bằng model cụ thể theo NINE_ROUTER_TIER_MODELS
   * (vd khi tier phía 9router lỗi credentials). Model cụ thể được giữ nguyên.
   */
  private resolveModel(model: string): string {
    return (TIER_NAMES as readonly string[]).includes(model)
      ? this.tierModels[model] || model
      : model;
  }

  private parseTierModels(raw?: string | null): Record<string, string> {
    if (!raw || !String(raw).trim()) return {};
    try {
      const parsed = JSON.parse(String(raw));
      const out: Record<string, string> = {};
      for (const tier of TIER_NAMES) {
        const value = parsed?.[tier];
        if (typeof value === 'string' && value.trim()) out[tier] = value.trim();
      }
      if (Object.keys(out).length) {
        this.logger.log(
          `Tier→model: ${Object.entries(out)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ')}`,
        );
      }
      return out;
    } catch {
      this.logger.warn(
        'NINE_ROUTER_TIER_MODELS không phải JSON hợp lệ (vd {"low":"ag/gemini-3.8-flash-low"}); bỏ qua.',
      );
      return {};
    }
  }

  private async postOnce(
    url: string,
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...request, stream: false }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new NineRouterError(
          `9router HTTP ${response.status} ${response.statusText}`,
          {
            status: response.status,
            retryable: isRetryableStatus(response.status),
            body: errorText,
            retryAfterMs: this.parseRetryAfter(
              response.headers?.get?.('retry-after') ?? null,
            ),
          },
        );
      }

      // Handle both standard JSON and single-chunk stream responses from upstream
      const responseText = await response.text();
      return this.parseCompletionResponse(responseText);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toNineRouterError(err: any): NineRouterError {
    if (err instanceof NineRouterError) return err;
    if (err?.name === 'AbortError') {
      return new NineRouterError(`9router timeout after ${this.timeoutMs}ms`, {
        retryable: true,
        cause: err,
      });
    }
    // fetch() network failures surface as TypeError; JSON/parse errors are not transient
    const isNetwork = err instanceof TypeError;
    return new NineRouterError(err?.message || 'Unknown 9router error', {
      retryable: isNetwork,
      cause: err,
    });
  }

  private backoffMs(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs !== undefined) {
      return Math.min(retryAfterMs, RETRY_AFTER_CAP_MS);
    }
    return (
      Math.pow(2, attempt) * BACKOFF_BASE_MS +
      Math.floor(Math.random() * BACKOFF_JITTER_MS)
    );
  }

  private parseRetryAfter(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    return undefined;
  }

  private readPositiveInt(key: string, fallback: number, min: number): number {
    const raw =
      this.configService?.get<string | number>(key) ?? process.env[key];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min ? n : fallback;
  }

  private parseCompletionResponse(
    responseText: string,
  ): ChatCompletionResponse {
    const trimmed = responseText.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }

    // Parse SSE lines if returned as data: {...}
    const lines = trimmed.split('\n');
    let aggregatedContent = '';
    let lastModel = '';
    let lastId = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    for (const line of lines) {
      const lineTrim = line.trim();
      if (!lineTrim.startsWith('data:') || lineTrim.includes('[DONE]'))
        continue;
      try {
        const json = JSON.parse(lineTrim.slice(5).trim());
        if (json.id) lastId = json.id;
        if (json.model) lastModel = json.model;
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) aggregatedContent += delta;
        if (json.usage) {
          totalPromptTokens = json.usage.prompt_tokens || totalPromptTokens;
          totalCompletionTokens =
            json.usage.completion_tokens || totalCompletionTokens;
        }
      } catch {
        // Skip unparseable chunks
      }
    }

    return {
      id: lastId || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: lastModel || 'unknown',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: aggregatedContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalPromptTokens + totalCompletionTokens,
      },
    };
  }

  private cleanBaseUrl(): string {
    return this.baseUrl.replace(/\/+$/, '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
