import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AuthSessionsController } from './auth-sessions.controller';

describe('AuthSessionsController', () => {
  const guarded = (name: keyof AuthSessionsController) =>
    (
      Reflect.getMetadata(
        GUARDS_METADATA,
        AuthSessionsController.prototype[name],
      ) ?? []
    ).includes(JwtAuthGuard);

  it('login, refresh, logout là công khai; còn lại bắt buộc JwtAuthGuard', () => {
    expect(guarded('login')).toBe(false);
    expect(guarded('refresh')).toBe(false);
    expect(guarded('logout')).toBe(false);
    for (const name of [
      'impersonate',
      'changePassword',
      'profile',
      'updateProfile',
    ] as const) {
      expect(guarded(name)).toBe(true);
    }
  });

  it('route nằm dưới api/v2/auth-sessions', () => {
    expect(Reflect.getMetadata('path', AuthSessionsController)).toBe(
      'api/v2/auth-sessions',
    );
  });

  it('truyền user-agent/ip và subject của JWT xuống service', async () => {
    const service = {
      login: jest.fn().mockResolvedValue({ message: 'ok' }),
      profile: jest.fn().mockResolvedValue({}),
      logout: jest.fn(),
    };
    const c = new AuthSessionsController(service as never);
    const req = { headers: { 'user-agent': 'ua' }, ip: '9.9.9.9' } as never;
    await c.login({ email: 'a@x.com', password: 'p' }, req);
    expect(service.login).toHaveBeenCalledWith('a@x.com', 'p', {
      userAgent: 'ua',
      ipAddress: '9.9.9.9',
    });
    await c.profile({ user: { sub: 'u1' } } as never);
    expect(service.profile).toHaveBeenCalledWith('u1');
  });
});
