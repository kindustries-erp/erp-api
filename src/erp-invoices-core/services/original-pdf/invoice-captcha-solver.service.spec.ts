import { ConfigService } from '@nestjs/config';
import { NineRouterError } from '../../../ai-hub-core/clients/nine-router.error';
import { NineRouterClient } from '../../../ai-hub-core/clients/nine-router.client';
import {
  CaptchaSolverConfigError,
  InvoiceCaptchaSolverService,
} from './invoice-captcha-solver.service';

describe('InvoiceCaptchaSolverService', () => {
  let service: InvoiceCaptchaSolverService;
  let mockConfigService: Partial<ConfigService>;
  let mockClient: { complete: jest.Mock };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'NINE_ROUTER_API_KEY') return 'test-api-key';
        if (key === 'NINE_ROUTER_VISION_MODEL') return 'ag/gemini-3.8-flash';
        return null;
      }) as any,
    };
    mockClient = { complete: jest.fn() };
    service = new InvoiceCaptchaSolverService(
      mockConfigService as ConfigService,
      mockClient as unknown as NineRouterClient,
    );
  });

  it('should solve captcha successfully from base64 via NineRouterClient', async () => {
    mockClient.complete.mockResolvedValue({
      choices: [{ message: { content: ' 6898\n' } }],
    });

    const result = await service.solveCaptchaBase64('dummyBase64Data');
    expect(result).toBe('6898');
    expect(mockClient.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'ag/gemini-3.8-flash',
        max_tokens: 20,
        messages: [
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'image_url',
                image_url: { url: 'data:image/png;base64,dummyBase64Data' },
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it('should strip data URI prefix before sending', async () => {
    mockClient.complete.mockResolvedValue({
      choices: [{ message: { content: 'ab12' } }],
    });
    await service.solveCaptchaBase64(
      'data:image/jpeg;base64,AAAA',
      'image/jpeg',
    );
    const sent = mockClient.complete.mock.calls[0][0];
    expect(sent.messages[0].content[1].image_url.url).toBe(
      'data:image/jpeg;base64,AAAA',
    );
  });

  it('should solve captcha from buffer', async () => {
    mockClient.complete.mockResolvedValue({
      choices: [{ message: { content: 'kL89' } }],
    });

    const result = await service.solveCaptchaImage(
      Buffer.from('image-binary-data'),
    );
    expect(result).toBe('kL89');
  });

  it('should throw error if API key is not configured', async () => {
    const emptyConfig: Partial<ConfigService> = {
      get: jest.fn().mockReturnValue(''),
    };
    delete process.env.NINE_ROUTER_API_KEY;

    const noKeyService = new InvoiceCaptchaSolverService(
      emptyConfig as ConfigService,
      mockClient as unknown as NineRouterClient,
    );

    await expect(noKeyService.solveCaptchaBase64('test')).rejects.toThrow(
      'NINE_ROUTER_API_KEY is not configured',
    );
    expect(mockClient.complete).not.toHaveBeenCalled();
  });

  it('should throw error when 9router responds with non-ok status', async () => {
    mockClient.complete.mockRejectedValue(
      new NineRouterError('9router HTTP 500', {
        status: 500,
        retryable: true,
        body: 'Internal Server Error',
      }),
    );

    await expect(service.solveCaptchaBase64('dummy')).rejects.toThrow(
      '9router captcha error (500)',
    );
  });

  it('should wrap non-HTTP failures (timeout/network)', async () => {
    mockClient.complete.mockRejectedValue(
      new NineRouterError('9router timeout after 30000ms', {
        retryable: true,
      }),
    );

    await expect(service.solveCaptchaBase64('dummy')).rejects.toThrow(
      '9router captcha error: 9router timeout after 30000ms',
    );
  });

  it('throws CaptchaSolverConfigError when the API key is missing', async () => {
    const emptyConfig: Partial<ConfigService> = {
      get: jest.fn().mockReturnValue(''),
    };
    delete process.env.NINE_ROUTER_API_KEY;
    const noKey = new InvoiceCaptchaSolverService(
      emptyConfig as ConfigService,
      mockClient as unknown as NineRouterClient,
    );
    await expect(noKey.solveCaptchaBase64('x')).rejects.toBeInstanceOf(
      CaptchaSolverConfigError,
    );
  });

  it.each([401, 403])(
    'throws CaptchaSolverConfigError when 9router rejects the key (%i)',
    async (status) => {
      mockClient.complete.mockRejectedValue(
        new NineRouterError(`9router HTTP ${status}`, {
          status,
          retryable: false,
          body: 'bad key',
        }),
      );
      const err = await service.solveCaptchaBase64('x').catch((e) => e);
      expect(err).toBeInstanceOf(CaptchaSolverConfigError);
      expect(err.message).toContain(`9router captcha error (${status})`);
    },
  );

  it('keeps a plain Error (not a config error) for transient failures like 503', async () => {
    mockClient.complete.mockRejectedValue(
      new NineRouterError('9router HTTP 503', {
        status: 503,
        retryable: true,
        body: 'down',
      }),
    );
    const err = await service.solveCaptchaBase64('x').catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(CaptchaSolverConfigError);
  });
});
