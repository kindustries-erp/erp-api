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

    const cleanBase64 = base64Data.replace(
      /^data:image\/[a-zA-Z]+;base64,/,
      '',
    );

    const payload = {
      model: this.model,
      stream: false,
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
              image_url: {
                url: `data:${mimeType};base64,${cleanBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 20,
    };

    const cleanBaseUrl = this.baseUrl.replace(/\/$/, '');
    const executeRequest = async () => {
      return fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    };

    let res: Response;
    try {
      res = await executeRequest();
    } catch (networkErr: any) {
      this.logger.warn(
        `9router network error on first try: ${networkErr.message}. Retrying once...`,
      );
      res = await executeRequest();
    }

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`9router captcha error (${res.status}): ${errText}`);
      throw new Error(`9router captcha error (${res.status}): ${errText}`);
    }

    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Failed to parse 9router JSON response: ${rawText.slice(0, 100)}`,
      );
    }

    const rawAnswer = data.choices?.[0]?.message?.content?.trim() || '';
    const cleaned = rawAnswer.replace(/[^a-zA-Z0-9]/g, '');
    this.logger.debug(`Solved captcha: "${rawAnswer}" -> "${cleaned}"`);
    return cleaned;
  }
}
