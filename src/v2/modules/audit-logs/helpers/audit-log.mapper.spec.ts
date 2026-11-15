import { AuditLog } from '../entities/audit-log.entity';
import { toAuditLogResponse } from './audit-log.mapper';

describe('toAuditLogResponse', () => {
  it('map đủ trường, giữ null và không lộ entity', () => {
    const createdAt = new Date('2026-11-15T09:00:00Z');
    const entity = Object.assign(new AuditLog(), {
      id: 'id-1',
      requestId: null,
      actorUserId: 'u1',
      actorEmail: 'a@b.com',
      actorEmployeeId: null,
      actionType: 'PATCH',
      module: 'users-management',
      entityType: 'core_user',
      entityId: 'e1',
      route: '/api/v2/users-management/e1',
      httpMethod: 'PATCH',
      status: 'SUCCESS',
      message: null,
      uiScreen: null,
      uiAction: null,
      beforeSnapshot: { a: 1 },
      afterSnapshot: { a: 2 },
      errorSnapshot: null,
      ipAddress: '1.1.1.1',
      userAgent: 'UA',
      createdAt,
    });
    const dto = toAuditLogResponse(entity);
    expect(dto).not.toBeInstanceOf(AuditLog);
    expect(dto.id).toBe('id-1');
    expect(dto.beforeSnapshot).toEqual({ a: 1 });
    expect(dto.requestId).toBeNull();
    expect(dto.createdAt).toBe(createdAt);
    expect(Object.keys(dto)).toHaveLength(21);
  });
});
