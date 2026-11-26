import type { CaseProgressItem } from '../dto/case-progress.dto';
import type { CaseWorkshopBoardItem } from '../dto/case-progress-log.dto';
import { CaseStatus } from '../entities/case-garage.enums';
import type { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { minutesBetween } from './case-progress-log.mapper';

const toDate = (iso: string | null) => (iso ? new Date(iso) : null);

/**
 * Thẻ xe board xưởng: dòng tiến độ + thời gian công đoạn đang mở + tổng thời gian.
 * - `stageElapsedMinutes`: từ `startedAt` của công đoạn mở tới hiện tại (null khi chưa ghi công đoạn).
 * - `totalElapsedMinutes`: từ tiếp nhận tới hoàn thành (xe đang Hoàn thành) hoặc tới hiện tại.
 */
export function toWorkshopBoardItem(
  item: CaseProgressItem,
  openStage: CaseProgressLogGarage | undefined,
  lastNote: CaseProgressLogGarage | undefined,
  now: Date,
): CaseWorkshopBoardItem {
  const received = toDate(item.receivedAt) ?? toDate(item.startedAt);
  // Xe mở lại từ Hoàn thành còn completedAt cũ: chỉ chốt khi đang Hoàn thành.
  const end =
    item.status === CaseStatus.COMPLETED
      ? (toDate(item.completedAt) ?? now)
      : now;
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
