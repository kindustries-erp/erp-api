import { Entity, Index } from 'typeorm';
import { BaseAuditLogEntity } from '@/v2/core/audit-core';

/** Nhật ký kiểm toán hệ thống. Bảng `audit_logs` (chuẩn đặt tên v2), dữ liệu backfill từ `erp_audit_logs`. */
@Entity({ name: 'audit_logs' })
@Index('IDX_audit_logs_entity_created', ['entityType', 'entityId', 'createdAt'])
@Index('IDX_audit_logs_created_at', ['createdAt'])
@Index('IDX_audit_logs_actor_created', ['actorUserId', 'createdAt'])
@Index('IDX_audit_logs_module_action', ['module', 'actionType'])
export class AuditLog extends BaseAuditLogEntity {}
