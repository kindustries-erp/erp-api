import type { Response } from 'express';
import { Observable } from 'rxjs';

import type {
  ExportJobRunner,
  ExportProgressEvent,
} from '../../common/export-jobs/export-job-runner';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const pingEvent = (message: string): ExportProgressEvent => ({
  processId: 'ping',
  current: 0,
  total: 100,
  isRunning: false,
  completed: false,
  ready: false,
  failed: false,
  message,
});

/** Gửi file xlsx đã tạo xong của runner về client. */
export function sendReadyExportFile(
  runner: ExportJobRunner,
  jobId: string,
  userId: string,
  res: Response,
) {
  const { buffer, fileName } = runner.getReadyFile(jobId, userId);
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

/** Luồng SSE tiến độ của runner, chỉ phát sự kiện thuộc `userId`. */
export function exportProgressStream(
  runner: ExportJobRunner,
  userId: string,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    const emit = (data: ExportProgressEvent) =>
      subscriber.next({ data: JSON.stringify(data) } as MessageEvent);

    emit(pingEvent('Connected'));

    const snapshot = runner.getJobSnapshotForUser(userId);
    if (snapshot) emit(snapshot);

    const intervalId = setInterval(() => emit(pingEvent('Ping')), 15000);

    const subscription = runner.progress$.subscribe({
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
