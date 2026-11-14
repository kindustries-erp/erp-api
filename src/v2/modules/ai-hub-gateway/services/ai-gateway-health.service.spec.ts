import { ConfigService } from '@nestjs/config';
import { AiGatewayHealthService } from './ai-gateway-health.service';

describe('AiGatewayHealthService', () => {
  const env: Record<string, string> = {
    NINE_ROUTER_BASE_URL: 'http://gw/v1',
    NINE_ROUTER_TIER_MODELS: '{"low":"m-low"}',
  };
  const build = () =>
    new AiGatewayHealthService({
      get: (key: string) => env[key],
    } as unknown as ConfigService);

  it('trả ok kèm tier đã cấu hình', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: [1, 2] }),
    }) as unknown as typeof fetch;

    await expect(build().check()).resolves.toMatchObject({
      ok: true,
      modelsCount: 2,
      hasApiKey: false,
      tiers: { low: ['m-low'] },
    });
  });

  it('trả ok=false kèm thông báo khi gateway lỗi', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('down')) as unknown as typeof fetch;

    const result = await build().check();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('down');
  });
});
