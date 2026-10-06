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
  });
});
