import type { CaseProgressItem } from '../dto/case-progress.dto';
import type { CaseGarage } from '../entities/case-garage.entity';
import { CaseStatus } from '../entities/case-garage.enums';
import { overriddenFields } from './case-override.helper';

const iso = (v: Date | null | undefined) => (v ? v.toISOString() : null);
const FINISHED: ReadonlySet<CaseStatus> = new Set([
  CaseStatus.COMPLETED,
  CaseStatus.CANCELLED,
]);

/** Số phút đã làm. Hiệu hai instant tuyệt đối nên không phụ thuộc múi giờ; null khi thiếu mốc bắt đầu. */
export function computeElapsedMinutes(
  c: Pick<CaseGarage, 'startedAt' | 'receivedAt' | 'completedAt'>,
  now: Date,
): number | null {
  const start = c.startedAt ?? c.receivedAt;
  if (!start) return null;
  const end = c.completedAt ?? now;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

/** Quá hạn: chưa hoàn thành/hủy và đã qua ngày hẹn xong. */
export function computeIsOverdue(
  c: Pick<CaseGarage, 'status' | 'expectedCompletionAt'>,
  now: Date,
): boolean {
  return (
    !FINISHED.has(c.status) &&
    c.expectedCompletionAt != null &&
    c.expectedCompletionAt.getTime() < now.getTime()
  );
}

export function toCaseProgressItem(
  c: CaseGarage,
  assigneeName: string | null,
  lineSummary: string | null,
  now: Date,
): CaseProgressItem {
  return {
    id: c.id,
    caseCode: c.caseCode,
    licensePlate: c.licensePlate ?? null,
    vehicleBrandName: c.vehicleBrandName ?? null,
    vehicleModelName: c.vehicleModelName ?? null,
    customerName: c.customerName ?? null,
    receivedAt: iso(c.receivedAt),
    startedAt: iso(c.startedAt),
    workSummary: c.requestDescription?.trim() || lineSummary,
    assigneeId: c.assigneeId ?? null,
    assigneeName,
    advisorCode: c.advisorCode ?? null,
    advisorName: c.advisorName ?? null,
    progressStage: c.progressStage ?? null,
    progressPercent: c.progressPercent ?? null,
    expectedCompletionAt: iso(c.expectedCompletionAt),
    status: c.status,
    origin: c.origin,
    statusName: c.statusName ?? null,
    completedAt: iso(c.completedAt),
    workshopTrackedAt: iso(c.workshopTrackedAt),
    elapsedMinutes: computeElapsedMinutes(c, now),
    isOverdue: computeIsOverdue(c, now),
    overriddenFields: overriddenFields(c.overrides),
  };
}
