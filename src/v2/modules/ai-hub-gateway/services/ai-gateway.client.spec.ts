import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiCompletionRequest } from '@/v2/core/ai-hub-core';
import { AiGatewayClient } from './ai-gateway.client';
import { AiUsageLogService } from './ai-usage-log.service';

class TestClient extends AiGatewayClient {
  protected wait(): Promise<void> {
    return Promise.resolve();
  }
}

function json(status: number, body: unknown) {
  return {
    ok: status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}
const ok = (content = '{"a":1}') =>
  json(200, {
    model: 'provider-internal-name',
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
  });
const abortError = () =>
  Object.assign(new Error('aborted'), { name: 'AbortError' });

describe('AiGatewayClient', () => {
  const env: Record<string, string> = {
    NINE_ROUTER_BASE_URL: 'http://gw/v1/',
    NINE_ROUTER_API_KEY: 'key',
    NINE_ROUTER_TIER_MODELS: '{"low":"m-low","high":["m-high","m-backup"]}',
    NINE_ROUTER_MAX_RETRIES: '2',
  };
  const request: AiCompletionRequest = {
    tier: 'low',
    featureCode: 'F',
    messages: [{ role: 'user', content: 'hi' }],
    meta: { fileName: 'a.png' },
  };
  let usageLog: { record: jest.Mock };
  let fetchMock: jest.Mock;
  let client: AiGatewayClient;
  const bodyOf = (call: number) =>
    JSON.parse(fetchMock.mock.calls[call][1].body);

  beforeEach(() => {
    usageLog = { record: jest.fn().mockResolvedValue(undefined) };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new TestClient(
      { get: (key: string) => env[key] } as unknown as ConfigService,
      usageLog as unknown as AiUsageLogService,
    );
    jest.spyOn(client['logger'], 'warn').mockImplementation();
  });

  it('chọn model theo tier, gửi stream:false và ghi usage log', async () => {
    fetchMock.mockResolvedValue(ok());

    const result = await client.complete(request);

    expect(fetchMock.mock.calls[0][0]).toBe('http://gw/v1/chat/completions');
    expect(bodyOf(0)).toMatchObject({ model: 'm-low', stream: false });
    expect(result).toMatchObject({
      content: '{"a":1}',
      tier: 'low',
      model: 'm-low',
      usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
    });
    expect(usageLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        featureCode: 'F',
        tier: 'low',
        modelName: 'm-low',
        outcome: 'SUCCESS',
        totalTokens: 7,
        meta: { fileName: 'a.png' },
      }),
    );
  });

  it('báo lỗi cấu hình khi tier chưa có model, không gọi mạng', async () => {
    await expect(
      client.complete({ ...request, tier: 'medium' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('thử lại lỗi tức thời (502) rồi thành công', async () => {
    fetchMock.mockResolvedValueOnce(json(502, {})).mockResolvedValueOnce(ok());

    await client.complete(request);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('timeout: chỉ gọi 1 lần, trả 504, dùng timeout của request', async () => {
    const timeouts: number[] = [];
    jest.spyOn(global, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms: number,
    ) => {
      timeouts.push(ms);
      return 0 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout);
    fetchMock.mockRejectedValue(abortError());

    await expect(
      client.complete({ ...request, timeoutMs: 120000 }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
    jest.restoreAllMocks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(timeouts).toContain(120000);
  });

  it('503 hết công suất: không thử lại, trả 502 kèm lý do gốc và ghi log ERROR', async () => {
    fetchMock.mockResolvedValue(
      json(503, { error: { message: 'No capacity available for model m' } }),
    );

    const error = await client.complete(request).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).toContain(
      'tier low, model m-low): HTTP 503: No capacity available for model m',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usageLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'ERROR', modelName: 'm-low' }),
    );
  });

  it('tier có model dự phòng: model đầu 503 thì gọi model kế và ghi model đó', async () => {
    fetchMock
      .mockResolvedValueOnce(json(503, { error: { message: 'No capacity' } }))
      .mockResolvedValueOnce(ok());

    const result = await client.complete({ ...request, tier: 'high' });

    expect(bodyOf(0).model).toBe('m-high');
    expect(bodyOf(1).model).toBe('m-backup');
    expect(result.model).toBe('m-backup');
    expect(usageLog.record).toHaveBeenCalledTimes(1);
    expect(usageLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'SUCCESS', modelName: 'm-backup' }),
    );
  });

  it('lỗi 4xx (sai key, sai request): không thử lại, không chuyển model', async () => {
    fetchMock.mockResolvedValue(json(401, { error: 'bad key' }));

    await expect(
      client.complete({ ...request, tier: 'high' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('mọi model của tier đều lỗi: báo lỗi của model cuối', async () => {
    fetchMock.mockRejectedValue(abortError());

    const error = await client
      .complete({ ...request, tier: 'high' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(GatewayTimeoutException);
    expect((error as Error).message).toContain('model m-backup');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('hết lượt thử với lỗi mạng thì trả 504', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    await expect(client.complete(request)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
