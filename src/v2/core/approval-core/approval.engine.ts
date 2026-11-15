import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

/** Một luật chuyển trạng thái: từ các trạng thái nào, sang trạng thái nào. */
export interface TransitionRule {
  readonly from: readonly string[];
  readonly to: string;
}

/**
 * Tra bảng chuyển trạng thái. Trả về trạng thái đích, hoặc ném 409 nếu
 * hành động không hợp lệ với trạng thái hiện tại.
 */
export function resolveTransition<A extends string>(
  rules: Record<A, TransitionRule>,
  current: string,
  action: A,
): string {
  const rule = rules[action];
  if (!rule) {
    throw new BadRequestException(`Hành động không hợp lệ: ${action}`);
  }
  if (!rule.from.includes(current)) {
    throw new ConflictException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Không thể ${action} khi đang ở trạng thái ${current}`,
      action,
      currentStatus: current,
    });
  }
  return rule.to;
}

/** Người duyệt không được là người tạo chứng từ. */
export function assertNotSelfApproval(
  actorId: string,
  createdBy: string | null,
): void {
  if (createdBy && createdBy === actorId) {
    throw new ForbiddenException(
      'Không được tự duyệt chứng từ do chính mình tạo',
    );
  }
}

/**
 * Chỉ người tạo chứng từ mới được thực hiện hành động (gửi duyệt, thu hồi,
 * hủy, xóa). Chứng từ cũ không có người tạo (null) thì không chặn.
 */
export function assertCreatorOnly(
  actorId: string,
  createdBy: string | null,
  verb: string,
): void {
  if (createdBy && createdBy !== actorId) {
    throw new ForbiddenException(`Chỉ người tạo mới được ${verb}`);
  }
}

/** Hành động mà người duyệt được chỉ định trên phiếu của người khác được phép làm. */
export const APPROVER_ALLOWED_ACTIONS: readonly string[] = [
  'approve',
  'reject',
];

/**
 * Người duyệt được chỉ định (không phải người tạo) chỉ được duyệt hoặc từ chối.
 * Người không phải người duyệt chỉ định không bị chặn ở đây (theo ma trận quyền).
 */
export function assertApproverOnlyDecides(
  actorId: string,
  doc: { approverId: string | null; createdBy: string | null },
  action: string,
): void {
  const isApprover = Boolean(doc.approverId) && doc.approverId === actorId;
  const isCreator = Boolean(doc.createdBy) && doc.createdBy === actorId;
  if (isApprover && !isCreator && !APPROVER_ALLOWED_ACTIONS.includes(action)) {
    throw new ForbiddenException(
      'Người duyệt chỉ được duyệt hoặc từ chối chứng từ của người tạo',
    );
  }
}

/** Từ chối, hủy, đóng thiếu đều bắt buộc có lý do không rỗng. */
export function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new BadRequestException('Bắt buộc nhập lý do');
  }
  return trimmed;
}
