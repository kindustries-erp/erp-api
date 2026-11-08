import type { ApprovalActorInfo } from '../approval-actor.service';
import { ApprovalEventResponseDto } from '../dto/approval-event-response.dto';

export interface ApprovalEventLike {
  action: string;
  fromStatus: string;
  toStatus: string;
  actorId: string;
  actorRoles: string[];
  comment: string | null;
  createdAt: Date;
}

/**
 * Chuyển entity nhật ký sang response DTO.
 * `actor` lấy từ ApprovalActorService; thiếu thì tên và email để null.
 */
export function toApprovalEventResponse(
  e: ApprovalEventLike,
  actor?: ApprovalActorInfo | null,
): ApprovalEventResponseDto {
  return {
    action: e.action,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    actorId: e.actorId,
    actorName: actor?.name ?? null,
    actorEmail: actor?.email ?? null,
    actorRoles: [...e.actorRoles],
    comment: e.comment,
    createdAt: e.createdAt,
  };
}
