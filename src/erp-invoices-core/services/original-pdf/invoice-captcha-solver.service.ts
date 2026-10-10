import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NineRouterClient } from '../../../ai-hub-core/clients/nine-router.client';
import { NineRouterError } from '../../../ai-hub-core/clients/nine-router.error';

/**
 * Lỗi cấu hình bộ giải captcha (thiếu NINE_ROUTER_API_KEY hoặc key bị 9router từ chối: 401/403).
 * Thử lại không giải quyết được -> adapter phải dừng ngay, không lặp vòng retry và không tải thêm captcha.
 */
export class CaptchaSolverConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptchaSolverConfigError';
  }
}

@Injectable()
export class InvoiceCaptchaSolverService {
  private readonly logger = new Logger(InvoiceCaptchaSolverService.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly nineRouterClient: NineRouterClient,
  ) {
    this.apiKey =
      this.configService.get<string>('NINE_ROUTER_API_KEY') ||
      process.env.NINE_ROUTER_API_KEY ||
      '';
    this.model =
      this.configService.get<string>('NINE_ROUTER_VISION_MODEL') ||
      process.env.NINE_ROUTER_VISION_MODEL ||
      'ag/gemini-3.8-flash';
  }

  async solveCaptchaImage(
    imageBuffer: Buffer,
    mimeType: string = 'image/png',
  ): Promise<string> {
    const base64Data = imageBuffer.toString('base64');
    return this.solveCaptchaBase64(base64Data, mimeType);
  }

  async solveCaptchaBase64(
    base64Data: string,
    mimeType: string = 'image/png',
  ): Promise<string> {
    if (!this.apiKey) {
      throw new CaptchaSolverConfigError(
        'NINE_ROUTER_API_KEY is not configured for captcha solver',
      );
    }

    const cleanBase64 = base64Data.replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      '',
    );

    let data;
    try {
      data = await this.nineRouterClient.complete({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Look at this captcha image carefully. It contains 4-6 alphanumeric characters. Return ONLY the exact text/characters with NO spaces, NO punctuation, NO formatting, NO markdown, NO explanations.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 20,
      });
    } catch (err: any) {
      if (
        err instanceof NineRouterError &&
        (err.status === 401 || err.status === 403)
      ) {
        throw new CaptchaSolverConfigError(
          `9router captcha error (${err.status}): API key không hợp lệ hoặc không có quyền`,
        );
      }
      const detail =
        err instanceof NineRouterError && err.status
          ? ` (${err.status}): ${err.bodySnippet ?? err.message}`
          : `: ${err.message}`;
      this.logger.error(`9router captcha error${detail}`);
      throw new Error(`9router captcha error${detail}`);
    }

    const rawAnswer = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = rawAnswer.replace(/[^a-zA-Z0-9]/g, '');
    this.logger.debug(`Solved captcha: "${rawAnswer}" -> "${cleaned}"`);
    return cleaned;
  }
}
