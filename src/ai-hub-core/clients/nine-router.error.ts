const BODY_SNIPPET_MAX = 500;

export interface NineRouterErrorOptions {
  status?: number;
  retryable: boolean;
  body?: string;
  retryAfterMs?: number;
  cause?: unknown;
}

export class NineRouterError extends Error {
  readonly status?: number;
  readonly retryable: boolean;
  readonly bodySnippet?: string;
  readonly retryAfterMs?: number;

  constructor(message: string, options: NineRouterErrorOptions) {
    super(message);
    this.name = 'NineRouterError';
    this.status = options.status;
    this.retryable = options.retryable;
    this.retryAfterMs = options.retryAfterMs;
    this.bodySnippet = options.body?.slice(0, BODY_SNIPPET_MAX);
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const RETRYABLE_STATUSES = new Set([408, 425, 429]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status) || status >= 500;
}
