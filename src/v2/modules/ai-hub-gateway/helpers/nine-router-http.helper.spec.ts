import {
  AiGatewayHttpError,
  backoffMs,
  extractErrorDetail,
  parseRetryAfterMs,
  requestGatewayJson,
} from './nine-router-http.helper';

const base = { url: 'http://gw/chat', apiKey: 'k', timeoutMs: 50 };

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

const failure = (fetchImpl: jest.Mock) =>
  requestGatewayJson({ ...base, fetchImpl }).catch(
    (e: unknown) => e,
  ) as Promise<AiGatewayHttpError>;

describe('nine-router-http.helper', () => {
  it('gửi Bearer và body JSON, trả JSON khi 2xx', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200, { ok: 1 }));
    const result = await requestGatewayJson({
      ...base,
      body: { a: 1 },
      fetchImpl,
    });
    expect(result).toEqual({ ok: 1 });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(init.body).toBe('{"a":1}');
  });

  it('báo lỗi rõ khi gateway trả stream thay vì JSON', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        response(200, 'data: {}', { 'content-type': 'text/event-stream' }),
      );
    const error = await failure(fetchImpl);
    expect(error.message).toContain('không phải JSON');
    expect(error.retryable).toBe(false);
  });

  it('429/502 thử lại được và đọc Retry-After', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(response(429, { e: 1 }, { 'retry-after': '2' }));
    await expect(failure(fetchImpl)).resolves.toMatchObject({
      kind: 'http',
      retryable: true,
      status: 429,
      retryAfterMs: 2000,
      canFallback: true,
    });
  });

  it('503 của nhà cung cấp: không thử lại cùng model, nêu lý do gốc, được chuyển model', async () => {
    const body =
      '{"error":{"message":"[antigravity/m] [503]: {\\n  \\"error\\": {\\n    \\"code\\": 503,\\n    \\"message\\": \\"No capacity available for model m\\"\\n}}"}}';
    const error = await failure(
      jest.fn().mockResolvedValue(response(503, body)),
    );
    expect(error.retryable).toBe(false);
    expect(error.canFallback).toBe(true);
    expect(error.message).toBe('HTTP 503: No capacity available for model m');
  });

  it('504 từ proxy (model chạy quá lâu): không thử lại cùng model, được chuyển model', async () => {
    const html =
      '<html>\r\n<head><title>504 Gateway Time-out</title></head>\r\n<body><center><h1>504 Gateway Time-out</h1></center><hr><center>openresty</center></body></html>';
    const error = await failure(
      jest
        .fn()
        .mockResolvedValue(
          response(504, html, { 'content-type': 'text/html' }),
        ),
    );
    expect(error.retryable).toBe(false);
    expect(error.canFallback).toBe(true);
    expect(error.message).toBe('HTTP 504: 504 Gateway Time-out');
  });

  it('400/401: không thử lại, không chuyển model', async () => {
    const error = await failure(
      jest.fn().mockResolvedValue(response(401, { error: 'API key required' })),
    );
    expect(error).toMatchObject({
      retryable: false,
      status: 401,
      canFallback: false,
    });
  });

  it('timeout: không thử lại cùng model; lỗi mạng: thử lại được', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const timeout = await failure(jest.fn().mockRejectedValue(abort));
    expect(timeout).toBeInstanceOf(AiGatewayHttpError);
    expect(timeout).toMatchObject({ kind: 'timeout', retryable: false });
    expect(timeout.canFallback).toBe(true);
    expect(timeout.message).toContain('Quá thời gian chờ');

    const network = await failure(
      jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    );
    expect(network).toMatchObject({ kind: 'network', retryable: true });
  });

  it('extractErrorDetail rút gọn JSON lồng, HTML và văn bản thường', () => {
    expect(
      extractErrorDetail('{"error":{"message":"No active credentials"}}'),
    ).toBe('No active credentials');
    expect(extractErrorDetail('<html><h1>Bad  Gateway</h1>\r\n</html>')).toBe(
      'Bad Gateway',
    );
    expect(extractErrorDetail('')).toBe('');
    expect(extractErrorDetail('x'.repeat(500))).toHaveLength(300);
  });

  it('backoff và Retry-After', () => {
    expect(backoffMs(0, undefined, () => 0)).toBe(500);
    expect(backoffMs(2, undefined, () => 0)).toBe(2000);
    expect(backoffMs(1, 1234)).toBe(1234);
    expect(parseRetryAfterMs('60')).toBe(10000);
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('abc')).toBeUndefined();
  });
});
