import { PURCHASE_REQUEST_STATUS } from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';
import type { PurchaseRequestStatus } from '@/v2/core/procurement-requests-core/contracts/procurement-requests.contract';

/**
 * Trạng thái PR cũ suy ra từ dự chi mua hàng (kind = PURCHASE).
 * - OPEN/PARTIAL/SETTLED -> APPROVED; có dấu đóng (ext.closed_at) -> CLOSED.
 * - CANCELLED có dấu đóng -> CLOSED; không có -> CANCELLED.
 * - PENDING_APPROVAL giữ nguyên; DRAFT và REJECTED -> DRAFT (PR cũ trả về nháp kèm lý do).
 * Dùng chung cho đặt hàng (3.14) và đọc PR (3.15).
 */
export function legacyPrStatus(
  forecastStatus: string,
  closedAt: Date | string | null,
): PurchaseRequestStatus {
  const closed = closedAt != null;
  switch (forecastStatus) {
    case 'CANCELLED':
      return (
        closed
          ? PURCHASE_REQUEST_STATUS.CLOSED
          : PURCHASE_REQUEST_STATUS.CANCELLED
      ) as PurchaseRequestStatus;
    case 'OPEN':
    case 'PARTIAL':
    case 'SETTLED':
      return (
        closed
          ? PURCHASE_REQUEST_STATUS.CLOSED
          : PURCHASE_REQUEST_STATUS.APPROVED
      ) as PurchaseRequestStatus;
    case 'PENDING_APPROVAL':
      return PURCHASE_REQUEST_STATUS.PENDING_APPROVAL as PurchaseRequestStatus;
    default:
      return PURCHASE_REQUEST_STATUS.DRAFT as PurchaseRequestStatus;
  }
}
