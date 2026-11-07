import { resolveTransition } from '@/v2/core/approval-core/approval.engine';
import {
  PURCHASE_REQUEST_STATUS,
  PURCHASE_REQUEST_TRANSITIONS,
  PurchaseRequestAction,
  PurchaseRequestStatus,
} from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import { legacyPrStatus } from './legacy-pr-status';

/** Trạng thái lưu trên dự chi: status + dấu đóng (ext.closed_at). */
export interface ForecastPrState {
  status: string;
  closed: boolean;
}

/**
 * Đổi trạng thái PR (PR cũ) sang trạng thái lưu trên dự chi.
 * PR Đóng = dự chi CANCELLED kèm dấu đóng; PR Duyệt = dự chi OPEN; PR Nháp = dự chi DRAFT.
 */
export function forecastStateOf(
  prStatus: PurchaseRequestStatus,
): ForecastPrState {
  switch (prStatus) {
    case PURCHASE_REQUEST_STATUS.DRAFT:
      return { status: 'DRAFT', closed: false };
    case PURCHASE_REQUEST_STATUS.PENDING_APPROVAL:
      return { status: 'PENDING_APPROVAL', closed: false };
    case PURCHASE_REQUEST_STATUS.APPROVED:
      return { status: 'OPEN', closed: false };
    case PURCHASE_REQUEST_STATUS.CLOSED:
      return { status: 'CANCELLED', closed: true };
    default:
      return { status: 'CANCELLED', closed: false };
  }
}

/**
 * Lập kế hoạch chuyển trạng thái trên dự chi. Dùng đúng bảng chuyển của PR (409 nếu sai),
 * nên quy tắc không đổi so với đề nghị cũ.
 */
export function planForecastPrTransition(
  current: { status: string; closedAt: Date | string | null },
  action: PurchaseRequestAction,
): {
  from: PurchaseRequestStatus;
  to: PurchaseRequestStatus;
  next: ForecastPrState;
} {
  const from = legacyPrStatus(current.status, current.closedAt);
  const to = resolveTransition(
    PURCHASE_REQUEST_TRANSITIONS,
    from,
    action,
  ) as PurchaseRequestStatus;
  return { from, to, next: forecastStateOf(to) };
}
