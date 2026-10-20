import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NineRouterClient } from './nine-router.client';

describe('NineRouterClient', () => {
  let client: NineRouterClient;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NINE_ROUTER_BASE_URL') {
        return 'https://test-9router.liouni.com/v1';
      }
      if (key === 'NINE_ROUTER_API_KEY') {
        return 'test-key';
      }
      return null;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    client = new NineRouterClient(mockConfigService);
  });

  describe('missing API key', () => {
    const OLD = process.env.NINE_ROUTER_API_KEY;
    afterEach(() => {
      if (OLD === undefined) delete process.env.NINE_ROUTER_API_KEY;
      else process.env.NINE_ROUTER_API_KEY = OLD;
      jest.restoreAllMocks();
    });

    it('warns once at construction when no key is configured', () => {
      delete process.env.NINE_ROUTER_API_KEY;
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const emptyConfig = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;

      new NineRouterClient(emptyConfig);

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('NINE_ROUTER_API_KEY'),
      );
    });

    it('does not warn when a key is configured', () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      new NineRouterClient(mockConfigService);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  it('should parse valid JSON completion response', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1700000000,
      model: 'ag/gemini-3.7-flash-medium',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello World' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify(mockResponse)),
    }) as any;

    const result = await client.complete({
      model: 'medium',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(result.choices[0].message?.content).toBe('Hello World');
    expect(result.model).toBe('ag/gemini-3.7-flash-medium');
  });

  it('should parse SSE stream response correctly into aggregated completion', async () => {
    const sseResponse = `
data: {"id":"chatcmpl-sse1","model":"gemini-3.7-flash","choices":[{"index":0,"delta":{"content":"Xin "}}]}
data: {"id":"chatcmpl-sse1","model":"gemini-3.7-flash","choices":[{"index":0,"delta":{"content":"chào"}}]}
data: [DONE]
`;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(sseResponse),
    }) as any;

    const result = await client.complete({
      model: 'low',
      messages: [{ role: 'user', content: 'ping' }],
    });

    expect(result.choices[0].message?.content).toBe('Xin chào');
  });

  describe('retry policy', () => {
    const okBody = JSON.stringify({
      id: 'chatcmpl-ok',
      object: 'chat.completion',
      created: 1,
      model: 'm',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        },
      ],
    });
    const request = {
      model: 'low',
      messages: [{ role: 'user' as const, content: 'ping' }],
    };

    beforeEach(() => {
      jest.spyOn(client as any, 'delay').mockResolvedValue(undefined);
    });

    it('should not retry on 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('bad key'),
      }) as any;

      await expect(client.complete(request)).rejects.toMatchObject({
        name: 'NineRouterError',
        status: 401,
        retryable: false,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 503 then succeed', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: jest.fn().mockResolvedValue('down'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(okBody),
        }) as any;

      const result = await client.complete(request);
      expect(result.choices[0].message?.content).toBe('ok');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should honor Retry-After on 429', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: () => '2' },
          text: jest.fn().mockResolvedValue('slow down'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(okBody),
        }) as any;

      await client.complete(request);
      expect((client as any).delay).toHaveBeenCalledWith(2000);
    });

    it('should throw NineRouterError after exhausting retries', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('boom'),
      }) as any;

      await expect(client.complete(request)).rejects.toMatchObject({
        status: 500,
        retryable: true,
        bodySnippet: 'boom',
      });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on timeout (AbortError)', async () => {
      const abort = Object.assign(new Error('aborted'), {
        name: 'AbortError',
      });
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(abort)
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(okBody),
        }) as any;

      const result = await client.complete(request);
      expect(result.id).toBe('chatcmpl-ok');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on network TypeError', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(okBody),
        }) as any;

      await client.complete(request);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on unparseable response body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue('{not json'),
      }) as any;

      await expect(client.complete(request)).rejects.toMatchObject({
        retryable: false,
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('tier → model map (NINE_ROUTER_TIER_MODELS)', () => {
    const OLD = process.env.NINE_ROUTER_TIER_MODELS;
    const okBody = JSON.stringify({
      id: 'x',
      object: 'chat.completion',
      created: 1,
      model: 'm',
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' } }],
    });
    const sentModel = () =>
      JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).model;

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(okBody),
      }) as any;
    });
    afterEach(() => {
      if (OLD === undefined) delete process.env.NINE_ROUTER_TIER_MODELS;
      else process.env.NINE_ROUTER_TIER_MODELS = OLD;
      jest.restoreAllMocks();
    });

    const make = (raw?: string) => {
      if (raw === undefined) delete process.env.NINE_ROUTER_TIER_MODELS;
      else process.env.NINE_ROUTER_TIER_MODELS = raw;
      return new NineRouterClient(mockConfigService);
    };
    const req = (model: string) => ({
      model,
      messages: [{ role: 'user' as const, content: 'ping' }],
    });

    it('replaces a tier name with the configured model', async () => {
      await make('{"low":"ag/gemini-3.8-flash-low"}').complete(req('low'));
      expect(sentModel()).toBe('ag/gemini-3.8-flash-low');
    });

    it('keeps tiers without a mapping and concrete model names untouched', async () => {
      const c = make('{"low":"ag/gemini-3.8-flash-low"}');
      await c.complete(req('medium'));
      expect(sentModel()).toBe('medium');
      (global.fetch as jest.Mock).mockClear();
      await c.complete(req('ag/gemini-3.8-flash'));
      expect(sentModel()).toBe('ag/gemini-3.8-flash');
    });

    it('ignores invalid JSON and unknown keys without throwing', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      await make('{not json').complete(req('low'));
      expect(sentModel()).toBe('low');
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('NINE_ROUTER_TIER_MODELS'),
      );
      (global.fetch as jest.Mock).mockClear();
      await make('{"bogus":"x","low":""}').complete(req('low'));
      expect(sentModel()).toBe('low');
    });
  });

  describe('deep health check', () => {
    const modelsOk = {
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }] }),
    };
    const completionOk = () => ({
      ok: true,
      text: jest.fn().mockResolvedValue(
        JSON.stringify({
          id: 'x',
          object: 'chat.completion',
          created: 1,
          model: 'm',
          choices: [
            { index: 0, message: { role: 'assistant', content: 'ok' } },
          ],
        }),
      ),
    });
    const completion503 = () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: jest
        .fn()
        .mockResolvedValue(
          '{"error":{"message":"No active credentials for provider: codex"}}',
        ),
    });

    it('stays shallow by default (no tier requests)', async () => {
      global.fetch = jest.fn().mockResolvedValue(modelsOk) as any;
      const h = await client.healthCheck();
      expect(h.tiers).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('reports every tier and ok=true when all tiers answer', async () => {
      global.fetch = jest
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(url.endsWith('/models') ? modelsOk : completionOk()),
        ) as any;
      const h = await client.healthCheck({ deep: true });
      expect(h.ok).toBe(true);
      expect(Object.keys(h.tiers ?? {})).toEqual(['low', 'medium', 'high']);
      expect(h.tiers?.low.ok).toBe(true);
    });

    it('flips ok=false and names the failing tier when a tier returns 503', async () => {
      global.fetch = jest.fn().mockImplementation((url: string, init: any) => {
        if (url.endsWith('/models')) return Promise.resolve(modelsOk);
        const model = JSON.parse(init.body).model;
        return Promise.resolve(
          model === 'medium' ? completion503() : completionOk(),
        );
      }) as any;
      const h = await client.healthCheck({ deep: true });
      expect(h.ok).toBe(false);
      expect(h.tiers?.medium.ok).toBe(false);
      expect(h.tiers?.medium.error).toContain('No active credentials');
      expect(h.tiers?.low.ok).toBe(true);
      expect(h.message).toContain('medium');
      expect(global.fetch).toHaveBeenCalledTimes(4); // /models + 3 tier, không retry
    });
  });

  it('should perform health check', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          { id: 'ag/gemini-3.7-flash-low' },
          { id: 'ag/gemini-3.7-flash-medium' },
        ],
      }),
    }) as any;

    const health = await client.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.modelsCount).toBe(2);
    expect(health.hasApiKey).toBe(true);
  });
});
