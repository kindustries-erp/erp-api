import type { CaseProgressLogItem } from '../dto/case-progress-log.dto';
import type { CaseProgressLogGarage } from '../entities/case-progress-log-garage.entity';
import { CaseProgressLogKind } from '../entities/case-progress.enums';

/** Số phút giữa hai mốc (không âm); null khi thiếu mốc đầu. */
export function minutesBetween(
  start: Date | null | undefined,
  end: Date,
): number | null {
  if (!start) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

/** Dòng nhật ký → response. Công đoạn đang mở tính thời lượng tới `now`; NOTE không có thời lượng. */
export function toProgressLogItem(
  log: CaseProgressLogGarage,
  now: Date,
): CaseProgressLogItem {
  const isStage = log.kind === CaseProgressLogKind.STAGE;
  return {
    id: log.id,
    caseId: log.caseId,
    kind: log.kind,
    caseStatus: log.caseStatus,
    stage: log.stage ?? null,
    note: log.note ?? null,
    workerId: log.workerId ?? null,
    workerName: log.workerName ?? null,
    startedAt: log.startedAt.toISOString(),
    endedAt: log.endedAt ? log.endedAt.toISOString() : null,
    durationMinutes: isStage
      ? minutesBetween(log.startedAt, log.endedAt ?? now)
      : null,
    createdBy: log.createdBy ?? null,
    updatedBy: log.updatedBy ?? null,
    createdAt: log.createdAt?.toISOString() ?? log.startedAt.toISOString(),
    updatedAt: log.updatedAt?.toISOString() ?? log.startedAt.toISOString(),
  };
}
