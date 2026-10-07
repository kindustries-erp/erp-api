import { ConfigService } from '@nestjs/config';
import { InvoiceCaptchaSolverService } from './invoice-captcha-solver.service';

describe('InvoiceCaptchaSolverService', () => {
  let service: InvoiceCaptchaSolverService;
  let mockConfigService: Partial<ConfigService>;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NINE_ROUTER_BASE_URL')
          return 'https://9router.liouni.com/v1';
        if (key === 'NINE_ROUTER_API_KEY') return 'test-api-key';
        if (key === 'NINE_ROUTER_VISION_MODEL') return 'ag/gemini-3.8-flash';
        return null;
      }) as any,
    };
    service = new InvoiceCaptchaSolverService(
      mockConfigService as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should solve captcha successfully from base64', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: ' 6898\n',
            },
          },
        ],
      }),
    } as any);

    const result = await service.solveCaptchaBase64('dummyBase64Data');
    expect(result).toBe('6898');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://9router.liouni.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('should solve captcha from buffer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'kL89',
            },
          },
        ],
      }),
    } as any);

    const buffer = Buffer.from('image-binary-data');
    const result = await service.solveCaptchaImage(buffer);
    expect(result).toBe('kL89');
  });

  it('should throw error if API key is not configured', async () => {
    const emptyConfig: Partial<ConfigService> = {
      get: jest.fn().mockReturnValue(''),
    };
    delete process.env.NINE_ROUTER_API_KEY;

    const noKeyService = new InvoiceCaptchaSolverService(
      emptyConfig as ConfigService,
    );

    await expect(noKeyService.solveCaptchaBase64('test')).rejects.toThrow(
      'NINE_ROUTER_API_KEY is not configured',
    );
  });

  it('should throw error when 9router responds with non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal Server Error'),
    } as any);

    await expect(service.solveCaptchaBase64('dummy')).rejects.toThrow(
      '9router captcha error (500)',
    );
  });
});
