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

/** Chuyển entity nhật ký sang response DTO. */
export function toApprovalEventResponse(
  e: ApprovalEventLike,
): ApprovalEventResponseDto {
  return {
    action: e.action,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    actorId: e.actorId,
    actorRoles: [...e.actorRoles],
    comment: e.comment,
    createdAt: e.createdAt,
  };
}
