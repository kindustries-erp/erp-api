import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogResponseDto } from '../dto/audit-log-response.dto';

/** Entity → response (hàm thuần). */
export function toAuditLogResponse(entity: AuditLog): AuditLogResponseDto {
  return {
    id: entity.id,
    requestId: entity.requestId,
    actorUserId: entity.actorUserId,
    actorEmail: entity.actorEmail,
    actorEmployeeId: entity.actorEmployeeId,
    actionType: entity.actionType,
    module: entity.module,
    entityType: entity.entityType,
    entityId: entity.entityId,
    route: entity.route,
    httpMethod: entity.httpMethod,
    status: entity.status,
    message: entity.message,
    uiScreen: entity.uiScreen,
    uiAction: entity.uiAction,
    beforeSnapshot: entity.beforeSnapshot,
    afterSnapshot: entity.afterSnapshot,
    errorSnapshot: entity.errorSnapshot,
    ipAddress: entity.ipAddress,
    userAgent: entity.userAgent,
    createdAt: entity.createdAt,
  };
}
