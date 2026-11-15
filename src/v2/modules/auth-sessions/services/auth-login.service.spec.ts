import { UnauthorizedException } from '@nestjs/common';
import { AuthLoginService, IMPERSONATOR_EMAIL } from './auth-login.service';

const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'a@x.com',
  status: 'ACTIVE',
  employeeId: 'e1',
  legacyDirectusUserId: null,
  ...over,
});

describe('AuthLoginService', () => {
  let users: Record<string, jest.Mock>;
  let sessions: Record<string, jest.Mock>;
  let jwt: { signAsync: jest.Mock };
  let audit: { recordAction: jest.Mock };
  let legacy: { exchange: jest.Mock };
  let service: AuthLoginService;

  beforeEach(() => {
    users = {
      authenticate: jest.fn(),
      recordLogin: jest.fn().mockResolvedValue(new Date()),
      findById: jest.fn(),
    };
    sessions = {
      issue: jest.fn().mockResolvedValue('raw-refresh'),
      rotate: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('jwt') };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    legacy = { exchange: jest.fn().mockResolvedValue(null) };
    service = new AuthLoginService(
      users as never,
      sessions as never,
      jwt as never,
      { get: () => '8h' } as never,
      audit as never,
      {
        getUserPreferences: jest.fn().mockResolvedValue({
          theme: 'dark',
          language: 'vi',
          tableConfigs: {},
          uiConfigs: {},
        }),
      } as never,
      legacy as never,
    );
  });

  describe('login', () => {
    it('thành công: ghi mốc đăng nhập, cấp token camelCase, payload JWT chung với v1', async () => {
      users.authenticate.mockResolvedValue({ user: user(), valid: true });
      const res = await service.login('A@X.com', 'pw', {
        ipAddress: '1.1.1.1',
      });
      expect(users.recordLogin).toHaveBeenCalledWith('u1');
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'a@x.com',
        status: 'ACTIVE',
      });
      expect(sessions.issue).toHaveBeenCalledWith('u1', {
        ipAddress: '1.1.1.1',
      });
      expect(res).toMatchObject({
        accessToken: 'jwt',
        refreshToken: 'raw-refresh',
        expiresIn: 28800,
        tokenType: 'Bearer',
        user: { id: 'u1', employeeId: 'e1' },
        preferences: { theme: 'dark' },
      });
      expect(JSON.stringify(res)).not.toContain('passwordHash');
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'LOGIN_SUCCESS' }),
      );
    });

    it('sai mật khẩu hoặc không có email: 401 cùng thông báo, ghi audit LOGIN_FAIL, không cấp token', async () => {
      users.authenticate.mockResolvedValue({ user: null, valid: false });
      await expect(service.login('x@x.com', 'bad')).rejects.toThrow(
        new UnauthorizedException('Sai email hoặc mật khẩu'),
      );
      users.authenticate.mockResolvedValue({ user: user(), valid: false });
      await expect(service.login('a@x.com', 'bad')).rejects.toThrow(
        'Sai email hoặc mật khẩu',
      );
      expect(sessions.issue).not.toHaveBeenCalled();
      expect(users.recordLogin).not.toHaveBeenCalled();
      expect(audit.recordAction).toHaveBeenCalledTimes(2);
    });

    it('tài khoản không ACTIVE: 401, không ghi mốc đăng nhập', async () => {
      users.authenticate.mockResolvedValue({
        user: user({ status: 'INACTIVE' }),
        valid: true,
      });
      await expect(service.login('a@x.com', 'pw')).rejects.toThrow(
        'Tài khoản đang bị khóa',
      );
      expect(users.recordLogin).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('xoay vòng và cấp access token mới', async () => {
      sessions.rotate.mockResolvedValue({
        previous: { userId: 'u1' },
        refreshToken: 'new-raw',
      });
      users.findById.mockResolvedValue(user());
      await expect(service.refresh('old')).resolves.toEqual({
        accessToken: 'jwt',
        refreshToken: 'new-raw',
        expiresIn: 28800,
        tokenType: 'Bearer',
      });
    });

    it('token v1 còn hiệu lực: đổi một lần sang phiên v2 giữ user-agent và ip', async () => {
      sessions.rotate.mockResolvedValue(null);
      legacy.exchange.mockResolvedValue({
        userId: 'u1',
        userAgent: 'ua',
        ipAddress: 'ip',
      });
      users.findById.mockResolvedValue(user());
      const res = await service.refresh('v1-token');
      expect(sessions.issue).toHaveBeenCalledWith('u1', {
        userAgent: 'ua',
        ipAddress: 'ip',
      });
      expect(res.refreshToken).toBe('raw-refresh');
    });

    it('token không hợp lệ: 401', async () => {
      sessions.rotate.mockResolvedValue(null);
      await expect(service.refresh('bad')).rejects.toThrow(
        'Refresh token không hợp lệ',
      );
    });

    it('tài khoản đã INACTIVE: 401 và thu hồi token vừa cấp', async () => {
      sessions.rotate.mockResolvedValue({
        previous: { userId: 'u1' },
        refreshToken: 'new-raw',
      });
      users.findById.mockResolvedValue(user({ status: 'INACTIVE' }));
      await expect(service.refresh('old')).rejects.toThrow(
        'Tài khoản không hoạt động',
      );
      expect(sessions.revoke).toHaveBeenCalledWith('new-raw');
    });
  });

  it('logout thu hồi token', async () => {
    await service.logout('raw');
    expect(sessions.revoke).toHaveBeenCalledWith('raw');
  });

  describe('impersonate', () => {
    it('chỉ admin@liouni.com được phép', async () => {
      users.findById.mockResolvedValueOnce(user({ email: 'other@x.com' }));
      await expect(service.impersonate('u9', 't1')).rejects.toThrow(
        IMPERSONATOR_EMAIL,
      );
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it('user đích không tồn tại hoặc không ACTIVE: 401', async () => {
      users.findById
        .mockResolvedValueOnce(user({ id: 'adm', email: IMPERSONATOR_EMAIL }))
        .mockResolvedValueOnce(null);
      await expect(service.impersonate('adm', 't1')).rejects.toThrow(
        'Không tìm thấy user đích',
      );
      users.findById
        .mockResolvedValueOnce(user({ id: 'adm', email: IMPERSONATOR_EMAIL }))
        .mockResolvedValueOnce(user({ id: 't1', status: 'INACTIVE' }));
      await expect(service.impersonate('adm', 't1')).rejects.toThrow(
        'Tài khoản đích đang bị khóa',
      );
    });

    it('thành công: JWT mang impersonatorId, ghi audit IMPERSONATE', async () => {
      users.findById
        .mockResolvedValueOnce(user({ id: 'adm', email: IMPERSONATOR_EMAIL }))
        .mockResolvedValueOnce(user({ id: 't1', email: 't@x.com' }));
      const res = await service.impersonate('adm', 't1');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 't1', impersonatorId: 'adm' }),
      );
      expect(res.user.id).toBe('t1');
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'IMPERSONATE', entityId: 't1' }),
      );
    });
  });
});
