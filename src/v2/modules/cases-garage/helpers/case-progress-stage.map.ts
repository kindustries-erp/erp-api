import { CaseStatus } from '../entities/case-garage.enums';
import { CaseProgressStage as S } from '../entities/case-progress.enums';

/** Status nhỏ thuộc từng status v2, theo thứ tự hiển thị trong cột Kanban. */
export const STAGES_BY_STATUS: Readonly<Record<CaseStatus, readonly S[]>> = {
  [CaseStatus.INTAKE]: [S.AWAITING_INSPECTION, S.INSPECTED, S.AWAITING_QUOTE],
  [CaseStatus.QUOTED]: [
    S.AWAITING_APPROVAL,
    S.CUSTOMER_APPROVED,
    S.QUOTE_REVISION,
  ],
  [CaseStatus.IN_PROGRESS]: [
    S.WAITING_PARTS,
    S.REPAIRING,
    S.PAINTING,
    S.QC,
    S.READY_FOR_DELIVERY,
  ],
  [CaseStatus.COMPLETED]: [S.AWAITING_PAYMENT, S.DELIVERED],
  [CaseStatus.CANCELLED]: [S.CUSTOMER_CANCELLED, S.INTERNAL_CANCELLED],
};

export function stagesOf(status: CaseStatus): readonly S[] {
  return STAGES_BY_STATUS[status] ?? [];
}

/** `stage` có thuộc `status` không; `null`/rỗng luôn hợp lệ (chưa có status nhỏ). */
export function isStageOf(
  status: CaseStatus,
  stage: string | null | undefined,
): boolean {
  if (!stage) return true;
  return (stagesOf(status) as readonly string[]).includes(stage);
}

/** Status cha của một status nhỏ; `null` khi mã lạ. */
export function statusOfStage(stage: string): CaseStatus | null {
  for (const [status, stages] of Object.entries(STAGES_BY_STATUS)) {
    if ((stages as readonly string[]).includes(stage)) {
      return status as CaseStatus;
    }
  }
  return null;
}
