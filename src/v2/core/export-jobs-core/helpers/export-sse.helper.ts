import { Observable } from 'rxjs';

import type { ExportProgressEvent } from '../types/export-job.types';

export interface SseResponseLike {
  setHeader(name: string, value: string): unknown;
  flushHeaders?: () => void;
}

/**
 * Header cho luồng Server-Sent Events: tắt đệm của proxy/CDN (nginx
 * X-Accel-Buffering) để từng sự kiện tiến trình được gửi ngay.
 */
export function applySseHeaders(res: SseResponseLike): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/** Nhịp giữ kết nối (ms) dùng ở luồng SSE của VinFast. */
export const SSE_PING_INTERVAL_MS = 10000;

/** Nhịp giữ kết nối mặc định (ms) của luồng tiến độ xuất file. */
export const EXPORT_SSE_DEFAULT_PING_MS = 15000;

/** Nguồn tiến độ: `ExportJobRunner` hoặc service kế thừa `AbstractExportJobService`. */
export interface ExportProgressSource {
  progress$: Observable<ExportProgressEvent>;
  getJobSnapshotForUser(userId: string): ExportProgressEvent | null;
}

export const exportPingEvent = (message: string): ExportProgressEvent => ({
  processId: 'ping',
  current: 0,
  total: 100,
  isRunning: false,
  completed: false,
  ready: false,
  failed: false,
  message,
});

/** Luồng SSE tiến độ, chỉ phát sự kiện thuộc `userId`. */
export function exportProgressStream(
  source: ExportProgressSource,
  userId: string,
  options: { pingIntervalMs?: number } = {},
): Observable<MessageEvent> {
  const pingIntervalMs = options.pingIntervalMs ?? EXPORT_SSE_DEFAULT_PING_MS;

  return new Observable<MessageEvent>((subscriber) => {
    const emit = (data: ExportProgressEvent) =>
      subscriber.next({ data: JSON.stringify(data) } as MessageEvent);

    emit(exportPingEvent('Connected'));

    const snapshot = source.getJobSnapshotForUser(userId);
    if (snapshot) emit(snapshot);

    const intervalId = setInterval(
      () => emit(exportPingEvent('Ping')),
      pingIntervalMs,
    );

    const subscription = source.progress$.subscribe({
      next: (data) => {
        if (data.userId !== userId) return;
        emit(data);
      },
      error: (err) => subscriber.error(err),
      complete: () => subscriber.complete(),
    });

    return () => {
      clearInterval(intervalId);
      subscription.unsubscribe();
    };
  });
}
