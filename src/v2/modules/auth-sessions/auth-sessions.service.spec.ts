import { AuthSessionsService } from './auth-sessions.service';

describe('AuthSessionsService', () => {
  const login = {
    login: jest.fn().mockResolvedValue({ accessToken: 'a' }),
    refresh: jest.fn().mockResolvedValue({ accessToken: 'b' }),
    logout: jest.fn().mockResolvedValue(undefined),
    impersonate: jest.fn().mockResolvedValue({ accessToken: 'c' }),
  };
  const profile = {
    profile: jest.fn().mockResolvedValue({ id: 'u1' }),
    updateProfile: jest.fn().mockResolvedValue({ id: 'u1' }),
    changePassword: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthSessionsService(login as never, profile as never);

  it('bọc kết quả theo hợp đồng { message, data }', async () => {
    await expect(service.login('a@x.com', 'p', {})).resolves.toEqual({
      message: expect.any(String),
      data: { accessToken: 'a' },
    });
    await expect(service.refresh('r')).resolves.toMatchObject({
      data: { accessToken: 'b' },
    });
    await expect(service.profile('u1')).resolves.toMatchObject({
      data: { id: 'u1' },
    });
  });

  it('logout và đổi mật khẩu chỉ trả message', async () => {
    await expect(service.logout('r')).resolves.toEqual({
      message: 'Đăng xuất thành công',
    });
    await expect(
      service.changePassword('u1', { oldPassword: 'o', newPassword: 'n' }, {}),
    ).resolves.toEqual({ message: 'Đổi mật khẩu thành công' });
    expect(profile.changePassword).toHaveBeenCalledWith('u1', 'o', 'n', {});
  });
});
