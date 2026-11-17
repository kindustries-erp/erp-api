import { buildAuditContext, UserRequest } from './audit-context';

describe('buildAuditContext', () => {
  it('lấy actor, route và header từ request', () => {
    const request = {
      user: { sub: 'u1', email: 'a@b.co' },
      originalUrl: '/api/v2/users-management',
      method: 'POST',
      ip: '1.2.3.4',
      headers: {
        'x-ui-screen': 'users',
        'x-request-id': 'r1',
        'user-agent': 'jest',
      },
    } as unknown as UserRequest;

    expect(buildAuditContext(request)).toEqual({
      actorUserId: 'u1',
      actorEmail: 'a@b.co',
      route: '/api/v2/users-management',
      httpMethod: 'POST',
      uiScreen: 'users',
      uiAction: null,
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
      requestId: 'r1',
    });
  });

  it('thiếu user hoặc header thì trả null, không ném lỗi', () => {
    const ctx = buildAuditContext({ headers: {} } as unknown as UserRequest);
    expect(ctx.actorUserId).toBeNull();
    expect(ctx.requestId).toBeNull();
  });
});
