export type AiGatewayErrorKind = 'timeout' | 'network' | 'http';

/** Lỗi khi gọi gateway model. `retryable`: có nên thử lại cùng model hay không. */
export class AiGatewayHttpError extends Error {
  constructor(
    message: string,
    readonly kind: AiGatewayErrorKind,
    readonly retryable: boolean,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AiGatewayHttpError';
  }

  /** Lỗi do model/nhà cung cấp (5xx, timeout, mạng): model dự phòng có thể chạy được. */
  get canFallback(): boolean {
    return (
      this.kind !== 'http' || (this.status ?? 0) >= 500 || this.status === 429
    );
  }
}

/**
 * Chỉ thử lại lỗi tức thời. 503/500 của 9router là lỗi nhà cung cấp (hết công suất,
 * thiếu credentials); 504 là proxy trước 9router cắt sau ~90 giây chờ model; timeout là mình tự cắt.
 * Ba loại này đã chờ lâu hoặc không tự hết: thử lại cùng model chỉ kéo dài thời gian treo.
 */
const RETRYABLE_STATUS = new Set([429, 502]);
const BACKOFF_BASE_MS = 500;
const BACKOFF_JITTER_MS = 250;
const RETRY_AFTER_CAP_MS = 10_000;
const ERROR_DETAIL_MAX = 300;

export type FetchLike = typeof fetch;

export interface GatewayHttpOptions {
  url: string;
  apiKey: string;
  timeoutMs: number;
  method?: 'GET' | 'POST';
  body?: unknown;
  fetchImpl?: FetchLike;
}

/** Gọi gateway một lần, có timeout. Trả JSON đã parse; lỗi quy về `AiGatewayHttpError`. */
export async function requestGatewayJson<T>(
  options: GatewayHttpOptions,
): Promise<T> {
  const { url, apiKey, timeoutMs, method = 'POST', body } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = extractErrorDetail(await response.text().catch(() => ''));
      throw new AiGatewayHttpError(
        `HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        'http',
        RETRYABLE_STATUS.has(response.status),
        response.status,
        parseRetryAfterMs(response.headers.get('retry-after')),
      );
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('json')) {
      throw new AiGatewayHttpError(
        `Gateway trả về '${contentType}', không phải JSON (thiếu stream:false?)`,
        'http',
        false,
        response.status,
      );
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AiGatewayHttpError) throw error;
    const aborted = (error as Error)?.name === 'AbortError';
    throw new AiGatewayHttpError(
      aborted
        ? `Quá thời gian chờ ${Math.round(timeoutMs / 1000)} giây`
        : `Lỗi mạng: ${(error as Error)?.message ?? 'không rõ'}`,
      aborted ? 'timeout' : 'network',
      !aborted,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rút lý do lỗi về một dòng. 9router bọc lỗi nhà cung cấp thành JSON lồng trong chuỗi:
 * ưu tiên `message` nằm sâu nhất, không có thì dùng nguyên văn đã gộp khoảng trắng.
 */
export function extractErrorDetail(body: string): string {
  const title = /<title>([^<]+)<\/title>/i.exec(body);
  if (title) return title[1].trim().slice(0, ERROR_DETAIL_MAX);
  const text = body.replace(/\\n/g, ' ').replace(/\\"/g, '"');
  const messages = [...text.matchAll(/"message"\s*:\s*"([^"]+)"/g)];
  const detail = messages.length ? messages[messages.length - 1][1] : text;
  return detail
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ERROR_DETAIL_MAX);
}

export function parseRetryAfterMs(header: string | null): number | undefined {
  const seconds = Number(header);
  if (!header || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.min(seconds * 1000, RETRY_AFTER_CAP_MS);
}

/** Thời gian chờ trước lần thử kế tiếp: ưu tiên Retry-After, nếu không thì lũy thừa kèm jitter. */
export function backoffMs(
  attempt: number,
  retryAfterMs?: number,
  random: () => number = Math.random,
): number {
  if (retryAfterMs !== undefined) return retryAfterMs;
  return (
    BACKOFF_BASE_MS * 2 ** attempt + Math.floor(random() * BACKOFF_JITTER_MS)
  );
}
