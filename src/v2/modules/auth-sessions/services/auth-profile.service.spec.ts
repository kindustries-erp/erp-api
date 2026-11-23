import { UnauthorizedException } from '@nestjs/common';
import { AuthProfileService } from './auth-profile.service';

describe('AuthProfileService', () => {
  let users: Record<string, jest.Mock>;
  let audit: { recordAction: jest.Mock };
  let service: AuthProfileService;
  const u = {
    id: 'u1',
    email: 'a@x.com',
    status: 'ACTIVE',
    employeeId: 'e1',
    passwordHash: 'SECRET',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    users = {
      findById: jest.fn().mockResolvedValue(u),
      getEmployee: jest.fn().mockResolvedValue({
        id: 'e1',
        employeeCode: 'NV1',
        fullName: 'An',
        email: null,
        phone: '09',
        status: 'ACTIVE',
        userId: 'u1',
      }),
      updateOwnProfile: jest.fn(),
      changeOwnPassword: jest.fn(),
    };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    service = new AuthProfileService(
      users as never,
      {
        getUserPermissions: jest
          .fn()
          .mockResolvedValue([
            { resource: 'r', action: 'a', conditions: null },
          ]),
      } as never,
      {
        getUserPreferences: jest.fn().mockResolvedValue({
          theme: 't',
          language: 'vi',
          tableConfigs: {},
          uiConfigs: {},
        }),
      } as never,
      audit as never,
    );
  });

  it('profile gộp user, nhân viên, quyền, preferences và không lộ passwordHash', async () => {
    const res = await service.profile('u1');
    expect(res.employee?.employeeCode).toBe('NV1');
    expect(res.permissions).toEqual([
      { resource: 'r', action: 'a', conditions: null },
    ]);
    expect(JSON.stringify(res)).not.toContain('SECRET');
  });

  it('profile: user không tồn tại thì 401', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.profile('x')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('updateProfile trả dữ liệu camelCase; user mất thì 401', async () => {
    users.updateOwnProfile.mockResolvedValueOnce({
      user: u,
      employee: { fullName: 'B', phone: null, notes: 'n' },
    });
    await expect(
      service.updateProfile('u1', { fullName: 'B' }),
    ).resolves.toEqual({
      id: 'u1',
      email: 'a@x.com',
      fullName: 'B',
      phone: null,
      notes: 'n',
    });
    users.updateOwnProfile.mockResolvedValueOnce(null);
    await expect(service.updateProfile('u1', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('changePassword', () => {
    it('thành công: ghi audit, không ném lỗi', async () => {
      users.changeOwnPassword.mockResolvedValue({ status: 'OK', user: u });
      await service.changePassword('u1', 'old', 'newpassword', {
        ip: '1.1.1.1',
      });
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'CHANGE_PASSWORD',
          ipAddress: '1.1.1.1',
          message: 'Đổi mật khẩu thành công',
        }),
      );
    });

    it('sai mật khẩu cũ: 401 và audit FAIL', async () => {
      users.changeOwnPassword.mockResolvedValue({
        status: 'WRONG_PASSWORD',
        user: u,
      });
      await expect(
        service.changePassword('u1', 'bad', 'newpassword'),
      ).rejects.toThrow('Mật khẩu cũ không đúng');
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAIL' }),
      );
    });

    it('không thấy user: 401, không audit', async () => {
      users.changeOwnPassword.mockResolvedValue({
        status: 'NOT_FOUND',
        user: null,
      });
      await expect(
        service.changePassword('u1', 'a', 'newpassword'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(audit.recordAction).not.toHaveBeenCalled();
    });
  });
});
