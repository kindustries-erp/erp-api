import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { hashPassword } from '@/v2/core/users-core';
import { UsersManagement } from '../entities/users-management.entity';
import { UsersAuthService } from './users-auth.service';

const makeUser = (over: Partial<UsersManagement> = {}): UsersManagement =>
  ({
    id: 'u1',
    email: 'a@b.co',
    passwordHash: 'x',
    status: 'ACTIVE',
    employeeId: null,
    legacyDirectusUserId: null,
    lastLoginAt: null,
    createdBy: null,
    passwordChangedAt: null,
    isDeleted: false,
    extraData: {},
    ...over,
  }) as UsersManagement;

describe('UsersAuthService', () => {
  let userRepo: Record<string, jest.Mock>;
  let employeeRepo: Record<string, jest.Mock>;
  let coreUserRepo: { save: jest.Mock };
  let tokenRepo: { update: jest.Mock };
  let query: jest.Mock;
  let service: UsersAuthService;

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((v: Partial<UsersManagement>) => makeUser(v)),
      save: jest.fn((v: UsersManagement) => Promise.resolve(v)),
    };
    employeeRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v: EmployeeManagement) => Promise.resolve(v)),
    };
    coreUserRepo = { save: jest.fn().mockResolvedValue(undefined) };
    tokenRepo = { update: jest.fn().mockResolvedValue(undefined) };
    query = jest.fn().mockResolvedValue([]);
    const repos = new Map<unknown, unknown>([
      [UsersManagement, userRepo],
      [EmployeeManagement, employeeRepo],
      [CoreUser, coreUserRepo],
      [CoreRefreshToken, tokenRepo],
    ]);
    const manager = {
      getRepository: (e: unknown) => repos.get(e),
      query,
    };
    service = new UsersAuthService({
      transaction: (work: (m: unknown) => Promise<unknown>) => work(manager),
      getRepository: (e: unknown) => repos.get(e),
    } as unknown as DataSource);
  });

  describe('authenticate', () => {
    it('đúng mật khẩu: valid và trả user', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ passwordHash: await hashPassword('Secret#1234') }),
      );
      const res = await service.authenticate('A@B.co ', 'Secret#1234');
      expect(res.valid).toBe(true);
      expect(res.user?.id).toBe('u1');
      expect(userRepo.findOne.mock.calls[0][0].where).toEqual({
        email: 'a@b.co',
        isDeleted: false,
      });
    });

    it('sai mật khẩu: không valid nhưng vẫn trả user để ghi audit', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ passwordHash: await hashPassword('Secret#1234') }),
      );
      const res = await service.authenticate('a@b.co', 'sai');
      expect(res.valid).toBe(false);
      expect(res.user).not.toBeNull();
    });

    it('không có tài khoản: không valid, user null, vẫn so khớp hash giả', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const res = await service.authenticate('x@b.co', 'bat-ky');
      expect(res).toEqual({ user: null, valid: false });
    });
  });

  it('recordLogin khóa hàng, ghi last_login_at và bản sao core_users', async () => {
    userRepo.findOne.mockResolvedValue(makeUser());
    const at = await service.recordLogin('u1');
    expect(userRepo.findOne.mock.calls[0][0].lock).toEqual({
      mode: 'pessimistic_write',
    });
    expect(at).toBeInstanceOf(Date);
    expect(coreUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', lastLoginAt: at }),
    );
  });

  it('recordLogin trả null khi không còn tài khoản', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.recordLogin('u1')).resolves.toBeNull();
    expect(coreUserRepo.save).not.toHaveBeenCalled();
  });

  describe('changeOwnPassword', () => {
    it('mật khẩu cũ đúng: đổi hash, thu hồi mọi phiên, ghi bản sao', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ passwordHash: await hashPassword('Old#12345') }),
      );
      const res = await service.changeOwnPassword(
        'u1',
        'Old#12345',
        'New#12345',
      );
      expect(res.status).toBe('OK');
      expect(userRepo.save).toHaveBeenCalledTimes(1);
      const saved = userRepo.save.mock.calls[0][0] as UsersManagement;
      expect(saved.passwordHash).not.toBe('New#12345');
      expect(saved.passwordChangedAt).toBeInstanceOf(Date);
      expect(tokenRepo.update).toHaveBeenCalledTimes(1);
      expect(String(query.mock.calls[0][0])).toContain('"auth_sessions"');
      expect(coreUserRepo.save).toHaveBeenCalledTimes(1);
    });

    it('mật khẩu cũ sai: WRONG_PASSWORD, không ghi gì, không thu hồi', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ passwordHash: await hashPassword('Old#12345') }),
      );
      const res = await service.changeOwnPassword('u1', 'sai', 'New#12345');
      expect(res.status).toBe('WRONG_PASSWORD');
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(tokenRepo.update).not.toHaveBeenCalled();
    });

    it('không có tài khoản: NOT_FOUND', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const res = await service.changeOwnPassword('u1', 'a', 'New#12345');
      expect(res).toEqual({ status: 'NOT_FOUND', user: null });
    });
  });

  describe('updateOwnProfile', () => {
    it('đổi email trùng người khác trả 409', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      userRepo.exists.mockResolvedValue(true);
      await expect(
        service.updateOwnProfile('u1', { email: 'Khac@b.co' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('chưa có hồ sơ nhân viên mà sửa họ tên: 400', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.updateOwnProfile('u1', { fullName: 'A' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('có nhân viên: cập nhật email, họ tên, điện thoại, khóa hàng nhân viên', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ employeeId: 'e1' }));
      employeeRepo.findOne.mockResolvedValue({
        id: 'e1',
        fullName: 'Cũ',
        phone: null,
        notes: null,
        email: null,
      });
      const res = await service.updateOwnProfile('u1', {
        email: 'Moi@B.co',
        fullName: ' Mới ',
        phone: '0909',
      });
      expect(res?.user.email).toBe('moi@b.co');
      expect(res?.employee?.fullName).toBe('Mới');
      expect(res?.employee?.phone).toBe('0909');
      expect(res?.employee?.email).toBe('moi@b.co');
      expect(employeeRepo.findOne.mock.calls[0][0].lock).toEqual({
        mode: 'pessimistic_write',
      });
      expect(coreUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'moi@b.co' }),
      );
    });

    it('vi phạm unique do đua request cũng trả 409', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      userRepo.save.mockRejectedValue({ code: '23505' });
      await expect(
        service.updateOwnProfile('u1', { email: 'moi@b.co' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('ensureSeedUser', () => {
    it('đã có thì không tạo lại', async () => {
      userRepo.exists.mockResolvedValue(true);
      await service.ensureSeedUser('Admin@X.co', 'Secret#1234');
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('chưa có: tạo với email chuẩn hóa, hash mật khẩu và ghi bản sao', async () => {
      await service.ensureSeedUser('Admin@X.co', 'Secret#1234');
      const created = userRepo.create.mock.calls[0][0] as UsersManagement;
      expect(created.email).toBe('admin@x.co');
      expect(created.passwordHash).not.toBe('Secret#1234');
      expect(coreUserRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});
