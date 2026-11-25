import { CaseOrigin, CaseStatus } from '../entities/case-garage.enums';

/** `tinh_trang_dich_vu` của KGara → trạng thái v2. */
const KGARA_TO_STATUS: Readonly<Record<number, CaseStatus>> = {
  0: CaseStatus.INTAKE,
  1: CaseStatus.QUOTED,
  2: CaseStatus.IN_PROGRESS,
  3: CaseStatus.COMPLETED,
  9: CaseStatus.CANCELLED,
};

const STATUS_TO_KGARA: Readonly<Record<CaseStatus, number>> = {
  [CaseStatus.INTAKE]: 0,
  [CaseStatus.QUOTED]: 1,
  [CaseStatus.IN_PROGRESS]: 2,
  [CaseStatus.COMPLETED]: 3,
  [CaseStatus.CANCELLED]: 9,
};

/** Mã lạ hoặc null: rơi về `INTAKE`, `kgaraStatusCode` gốc vẫn được giữ riêng. */
export function kgaraCodeToStatus(code: number | null | undefined): CaseStatus {
  return (code != null && KGARA_TO_STATUS[code]) || CaseStatus.INTAKE;
}

export function statusToKgaraCode(status: CaseStatus): number {
  return STATUS_TO_KGARA[status];
}

/** Chuyển trạng thái hợp lệ cho xe NATIVE. */
const TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  [CaseStatus.INTAKE]: [
    CaseStatus.QUOTED,
    CaseStatus.IN_PROGRESS,
    CaseStatus.CANCELLED,
  ],
  [CaseStatus.QUOTED]: [CaseStatus.IN_PROGRESS, CaseStatus.CANCELLED],
  [CaseStatus.IN_PROGRESS]: [CaseStatus.COMPLETED, CaseStatus.CANCELLED],
  [CaseStatus.COMPLETED]: [CaseStatus.IN_PROGRESS],
  [CaseStatus.CANCELLED]: [CaseStatus.INTAKE],
};

/**
 * Xe `KGARA_SYNC` đổi trạng thái tự do (trừ đổi sang chính nó): v2 chỉ ghi đè, trạng thái KGara vẫn
 * giữ ở snapshot và hoàn lại được bằng revert. Xe `NATIVE` (mặc định) theo bảng `TRANSITIONS`.
 */
export function canTransition(
  from: CaseStatus,
  to: CaseStatus,
  origin: CaseOrigin = CaseOrigin.NATIVE,
): boolean {
  if (origin === CaseOrigin.KGARA_SYNC) return from !== to;
  return TRANSITIONS[from]?.includes(to) ?? false;
}
