/**
 * sse-headers.helper.ts
 *
 * Header cho luồng Server-Sent Events: tắt đệm của proxy/CDN (nginx X-Accel-Buffering)
 * để từng sự kiện tiến trình được gửi ngay, không bị giữ lại.
 */

export interface SseResponseLike {
  setHeader(name: string, value: string): unknown;
  flushHeaders?: () => void;
}

export function applySseHeaders(res: SseResponseLike): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/** Nhịp giữ kết nối (ms) để proxy không cắt luồng im lặng. */
export const SSE_PING_INTERVAL_MS = 10000;
