import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  NineRouterClientOptions,
} from './nine-router.types';

@Injectable()
export class NineRouterClient {
  private readonly logger = new Logger(NineRouterClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(
    private readonly configService?: ConfigService,
    options?: NineRouterClientOptions,
  ) {
    this.baseUrl =
      options?.baseUrl ||
      this.configService?.get<string>('NINE_ROUTER_BASE_URL') ||
      process.env.NINE_ROUTER_BASE_URL ||
      'https://9router.liouni.com/v1';

    this.apiKey =
      options?.apiKey ||
      this.configService?.get<string>('NINE_ROUTER_API_KEY') ||
      process.env.NINE_ROUTER_API_KEY ||
      '';

    this.timeoutMs = options?.timeoutMs || 30000;
    this.maxRetries =
      options?.maxRetries !== undefined ? options?.maxRetries : 2;
  }

  /**
   * Send a synchronous Chat Completion request to 9router
   */
  async complete(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const url = `${this.cleanBaseUrl()}/chat/completions`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...request,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `9router HTTP ${response.status} ${response.statusText}: ${errorText}`,
          );
        }

        // Handle both standard JSON and single-chunk stream responses from upstream
        const responseText = await response.text();
        return this.parseCompletionResponse(responseText);
      } catch (err: any) {
        lastError = err;
        this.logger.warn(
          `9router attempt ${attempt + 1}/${this.maxRetries + 1} failed: ${err.message}`,
        );
        if (attempt < this.maxRetries) {
          await this.delay(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw lastError || new Error('9router request failed after retries');
  }

  /**
   * Health check probe to verify connectivity to 9router
   */
  async healthCheck(): Promise<{
    ok: boolean;
    latencyMs: number;
    modelsCount: number;
    message?: string;
  }> {
    const start = Date.now();
    try {
      const url = `${this.cleanBaseUrl()}/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          modelsCount: 0,
          message: `HTTP ${res.status} ${res.statusText}`,
        };
      }

      const data = await res.json();
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      return {
        ok: true,
        latencyMs,
        modelsCount: count,
      };
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        modelsCount: 0,
        message: err.message,
      };
    }
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
