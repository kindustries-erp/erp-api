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

/** Từ chối, hủy, đóng thiếu đều bắt buộc có lý do không rỗng. */
export function requireReason(reason: string | null | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new BadRequestException('Bắt buộc nhập lý do');
  }
  return trimmed;
}
