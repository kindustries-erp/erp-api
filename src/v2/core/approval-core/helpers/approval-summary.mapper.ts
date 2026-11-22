import {
  ApprovalStepDto,
  ApprovalSummaryDto,
} from '../dto/approval-summary.dto';

/** Tra email theo user id. Trả null khi không có id hoặc không tìm thấy. */
export type ApprovalEmailLookup = (
  userId: string | null | undefined,
) => string | null;

/** Các cột duyệt đọc từ header entity. Trường của PO (issue) không có ở PR thì bỏ qua. */
export interface ApprovalHeaderLike {
  approverId: string | null;
  submittedBy: string | null;
  submittedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  closedBy: string | null;
  closedAt: Date | null;
  closeReason: string | null;
  issuedBy?: string | null;
  issuedAt?: Date | null;
}

/** Bước đã xảy ra khi có thời điểm. Người thực hiện có thể null (đóng tự động do đủ hàng). */
function step(
  by: string | null | undefined,
  at: Date | null | undefined,
  emailOf: ApprovalEmailLookup,
  reason?: string | null,
): ApprovalStepDto | null {
  if (!at) return null;
  const out: ApprovalStepDto = {
    by: by ?? null,
    byEmail: emailOf(by),
    at,
  };
  if (reason !== undefined) out.reason = reason;
  return out;
}

/**
 * Dựng khối `approval` từ các cột duyệt. Hàm thuần: email lấy qua `emailOf`
 * (tra theo lô ở facade, không truy vấn trong mapper).
 * Chế độ AUTO: submit tự duyệt cho ra cả bước submit lẫn approve cùng người.
 */
export function toApprovalSummary(
  h: ApprovalHeaderLike,
  emailOf: ApprovalEmailLookup,
): ApprovalSummaryDto {
  return {
    approverId: h.approverId,
    approverEmail: emailOf(h.approvedBy ?? h.approverId),
    submit: step(h.submittedBy, h.submittedAt, emailOf),
    approve: step(h.approvedBy, h.approvedAt, emailOf),
    reject: step(h.rejectedBy, h.rejectedAt, emailOf, h.rejectReason),
    cancel: step(h.cancelledBy, h.cancelledAt, emailOf, h.cancelReason),
    close: step(h.closedBy, h.closedAt, emailOf, h.closeReason),
    issue: step(h.issuedBy, h.issuedAt, emailOf),
  };
}
