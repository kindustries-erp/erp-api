import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersAdminService } from './users-admin.service';

describe('UsersAdminService (ghi ủy quyền sang v2)', () => {
  const coreUser = {
    id: 'u1',
    email: 'a@x.com',
    status: 'ACTIVE',
    employeeId: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'SECRET',
  };
  const request = {
    user: { sub: 'admin', email: 'admin@x.com' },
    headers: { 'user-agent': 'ua' },
    ip: '1.1.1.1',
    originalUrl: '/api/v1/admin/users',
    method: 'POST',
  } as never;

  let usersRepo: { findOne: jest.Mock };
  let v2: Record<string, jest.Mock>;
  let auth: { changeOwnPassword: jest.Mock };
  let audit: { recordAction: jest.Mock };
  let service: UsersAdminService;

  beforeEach(() => {
    usersRepo = { findOne: jest.fn().mockResolvedValue(coreUser) };
    v2 = {
      create: jest.fn().mockResolvedValue({ data: { id: 'u1' } }),
      update: jest.fn().mockResolvedValue({}),
      activate: jest.fn().mockResolvedValue({}),
      deactivate: jest.fn().mockResolvedValue({}),
      resetPassword: jest.fn().mockResolvedValue({}),
      linkEmployee: jest.fn().mockResolvedValue({}),
      unlinkEmployee: jest.fn().mockResolvedValue({}),
    };
    auth = { changeOwnPassword: jest.fn() };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    service = new UsersAdminService(
      usersRepo as never,
      { findOne: jest.fn() } as never,
      {} as never,
      v2 as never,
      auth as never,
      audit as never,
    );
  });

  it('createUser ủy quyền sang v2.create với ngữ cảnh audit của request và không lộ passwordHash', async () => {
    const res = await service.createUser(
      { email: 'A@x.com', password: 'password1' },
      request,
    );
    expect(v2.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'A@x.com', password: 'password1' }),
      expect.objectContaining({ actorUserId: 'admin', ipAddress: '1.1.1.1' }),
    );
    expect(res.message).toBe('Tạo user thành công');
    expect(JSON.stringify(res)).not.toContain('SECRET');
  });

  it('updateUser chuyển status và employeeId sang v2.update', async () => {
    await service.updateUser(
      'u1',
      { status: 'INACTIVE', employeeId: null },
      request,
    );
    expect(v2.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ status: 'INACTIVE', employeeId: null }),
      expect.anything(),
    );
  });

  it('activate, deactivate, link, unlink, resetPassword đều đi qua v2', async () => {
    await service.activateUser('u1', request);
    await service.deactivateUser('u1', request);
    await service.linkEmployee('u1', { employeeId: 'e1' }, request);
    await service.unlinkEmployee('u1', request);
    await expect(
      service.resetPassword('u1', { newPassword: 'newpassword1' }, request),
    ).resolves.toEqual({ message: 'Reset password thành công' });
    expect(v2.activate).toHaveBeenCalledWith('u1', expect.anything());
    expect(v2.deactivate).toHaveBeenCalledWith('u1', expect.anything());
    expect(v2.linkEmployee).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ employeeId: 'e1' }),
      expect.anything(),
    );
    expect(v2.unlinkEmployee).toHaveBeenCalledWith('u1', expect.anything());
    expect(v2.resetPassword).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ newPassword: 'newpassword1' }),
      expect.anything(),
    );
  });

  it('lỗi từ v2 (409/404) được giữ nguyên, không nuốt', async () => {
    v2.update.mockRejectedValue(
      new NotFoundException('Không tìm thấy tài khoản'),
    );
    await expect(
      service.updateUser('zz', { status: 'ACTIVE' }, request),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('changeSelfPassword', () => {
    it('thành công: ghi audit', async () => {
      auth.changeOwnPassword.mockResolvedValue({
        status: 'OK',
        user: coreUser,
      });
      await expect(
        service.changeSelfPassword(
          'u1',
          { oldPassword: 'o', newPassword: 'n1234567' },
          request,
        ),
      ).resolves.toEqual({ message: 'Đổi mật khẩu thành công' });
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'CHANGE_PASSWORD' }),
      );
    });

    it('sai mật khẩu cũ: 401 và audit FAIL', async () => {
      auth.changeOwnPassword.mockResolvedValue({
        status: 'WRONG_PASSWORD',
        user: coreUser,
      });
      await expect(
        service.changeSelfPassword(
          'u1',
          { oldPassword: 'x', newPassword: 'n1234567' },
          request,
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAIL' }),
      );
    });

    it('không thấy user: 404', async () => {
      auth.changeOwnPassword.mockResolvedValue({
        status: 'NOT_FOUND',
        user: null,
      });
      await expect(
        service.changeSelfPassword(
          'u1',
          { oldPassword: 'x', newPassword: 'n1234567' },
          request,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
