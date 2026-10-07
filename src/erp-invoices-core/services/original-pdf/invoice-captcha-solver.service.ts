import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoiceCaptchaSolverService {
  private readonly logger = new Logger(InvoiceCaptchaSolverService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('NINE_ROUTER_BASE_URL') ||
      process.env.NINE_ROUTER_BASE_URL ||
      'https://9router.liouni.com/v1';
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
      throw new Error(
        'NINE_ROUTER_API_KEY is not configured for captcha solver',
      );
    }

    const payload = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Look at this captcha image carefully. Return ONLY the exact alphanumeric characters with NO extra spaces, NO formatting, NO markdown, NO explanations.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 20,
    };

    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`9router captcha error (${res.status}): ${errText}`);
      throw new Error(`9router captcha error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const rawAnswer = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = rawAnswer.replace(/[^a-zA-Z0-9]/g, '');
    this.logger.debug(`Solved captcha: "${rawAnswer}" -> "${cleaned}"`);
    return cleaned;
  }
}
