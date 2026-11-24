import type { CaseProgressItem } from '../dto/case-progress.dto';
import type { CaseWorkshopBoardItem } from '../dto/case-progress-log.dto';
import type { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { minutesBetween } from './case-progress-log.mapper';

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

/**
 * Thẻ xe board xưởng: dòng tiến độ + thời gian công đoạn đang mở + tổng thời gian.
 * - `stageElapsedMinutes`: từ `startedAt` của công đoạn mở tới hiện tại (null khi chưa ghi công đoạn).
 * - `totalElapsedMinutes`: từ tiếp nhận tới hoàn thành (hoặc hiện tại).
 */
export function toWorkshopBoardItem(
  item: CaseProgressItem,
  openStage: CaseProgressLogGarage | undefined,
  lastNote: CaseProgressLogGarage | undefined,
  now: Date,
): CaseWorkshopBoardItem {
  const received = toDate(item.receivedAt) ?? toDate(item.startedAt);
  const end = toDate(item.completedAt) ?? now;
  return {
    ...item,
    stageStartedAt: openStage ? openStage.startedAt.toISOString() : null,
    stageElapsedMinutes: openStage
      ? minutesBetween(openStage.startedAt, now)
      : null,
    totalElapsedMinutes: minutesBetween(received, end),
    stageWorkerName: openStage?.workerName ?? null,
    lastNote: lastNote?.note ?? null,
  };
}
