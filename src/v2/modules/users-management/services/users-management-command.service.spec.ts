import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { EmployeeManagement } from '@/v2/modules/employees-management/entities/employee-management.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { verifyPassword } from '@/v2/core/users-core';
import { UsersManagement } from '../entities/users-management.entity';
import type { UserAuditContext } from '../helpers/audit-context';
import { UsersManagementCommandService } from './users-management-command.service';
import type { UsersAuditWriter } from './users-audit.writer';
import type { UsersEmployeeLinkService } from './users-employee-link.service';

const ctx = (actorUserId: string | null = 'admin-1'): UserAuditContext => ({
  actorUserId,
  actorEmail: 'admin@liouni.com',
  route: '/api/v2/users-management',
  httpMethod: 'POST',
  uiScreen: null,
  uiAction: null,
  ipAddress: null,
  userAgent: null,
  requestId: null,
});

const makeUser = (over: Partial<UsersManagement> = {}): UsersManagement =>
  ({
    id: 'u1',
    email: 'a@b.co',
    passwordHash: 'old-hash',
    status: 'ACTIVE',
    employeeId: null,
    legacyDirectusUserId: null,
    lastLoginAt: null,
    createdBy: null,
    passwordChangedAt: null,
    extraData: {},
    isDeleted: false,
    createdAt: new Date('2026-11-15T00:00:00Z'),
    updatedAt: new Date('2026-11-15T00:00:00Z'),
    ...over,
  }) as UsersManagement;

describe('UsersManagementCommandService', () => {
  let userRepo: {
    findOne: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let employeeRepo: { findOne: jest.Mock };
  let coreUserRepo: { save: jest.Mock };
  let tokenRepo: { update: jest.Mock };
  let managerQuery: jest.Mock;
  let transaction: jest.Mock;
  let links: { apply: jest.Mock };
  let audit: { write: jest.Mock };
  let service: UsersManagementCommandService;

  beforeEach(() => {
    userRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((v: Partial<UsersManagement>) => makeUser(v)),
      save: jest.fn((v: UsersManagement) => Promise.resolve(v)),
    };
    employeeRepo = { findOne: jest.fn().mockResolvedValue(null) };
    coreUserRepo = { save: jest.fn().mockResolvedValue(undefined) };
    tokenRepo = { update: jest.fn().mockResolvedValue(undefined) };
    const repos = new Map<unknown, unknown>([
      [UsersManagement, userRepo],
      [EmployeeManagement, employeeRepo],
      [CoreUser, coreUserRepo],
      [CoreRefreshToken, tokenRepo],
    ]);
    managerQuery = jest.fn().mockResolvedValue([]);
    const manager = {
      getRepository: (entity: unknown) => repos.get(entity),
      query: managerQuery,
    };
    transaction = jest.fn((work: (m: unknown) => Promise<unknown>) =>
      work(manager),
    );
    links = { apply: jest.fn().mockResolvedValue(null) };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    service = new UsersManagementCommandService(
      { transaction } as unknown as DataSource,
      links as unknown as UsersEmployeeLinkService,
      audit as unknown as UsersAuditWriter,
    );
  });

  describe('create', () => {
    it('chuẩn hóa email, hash mật khẩu, đồng bộ core_users và ghi đúng một audit', async () => {
      const res = await service.create(
        { email: '  New@Liouni.COM ', password: 'Secret#1234' },
        ctx(),
      );

      expect(res.email).toBe('new@liouni.com');
      expect(res).not.toHaveProperty('passwordHash');
      const created = userRepo.create.mock.calls[0][0] as UsersManagement;
      expect(created.passwordHash).not.toBe('Secret#1234');
      await expect(
        verifyPassword('Secret#1234', created.passwordHash),
      ).resolves.toBe(true);
      expect(created.createdBy).toBe('admin-1');
      expect(coreUserRepo.save).toHaveBeenCalledTimes(1);
      expect(audit.write).toHaveBeenCalledTimes(1);
      expect(audit.write.mock.calls[0][1].actionType).toBe('CREATE_USER');
    });

    it('email đã tồn tại trả 409 và không ghi audit', async () => {
      userRepo.exists.mockResolvedValue(true);
      await expect(
        service.create({ email: 'a@b.co', password: 'Secret#1234' }, ctx()),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.write).not.toHaveBeenCalled();
    });

    it('liên kết nhân viên khi có employeeId', async () => {
      await service.create(
        {
          email: 'a@b.co',
          password: 'Secret#1234',
          employeeId: 'e1',
        },
        ctx(),
      );
      expect(links.apply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'e1',
      );
    });
  });

  describe('nguồn chính là users_management', () => {
    it('không đọc hay khóa core_users trước khi đọc tài khoản; chỉ ghi bản sao sau khi lưu', async () => {
      const order: string[] = [];
      managerQuery.mockImplementation(() => {
        order.push('raw-query');
        return Promise.resolve([]);
      });
      userRepo.findOne.mockImplementation(() => {
        order.push('read-user');
        return Promise.resolve(makeUser());
      });
      coreUserRepo.save.mockImplementation(() => {
        order.push('mirror-core');
        return Promise.resolve(undefined);
      });

      await service.activate('u1', ctx());

      expect(order).toEqual(['read-user', 'mirror-core']);
    });
  });

  describe('trạng thái', () => {
    it('deactivate: khóa hàng, thu hồi refresh token, một audit DEACTIVATE_USER', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());

      const res = await service.deactivate('u1', ctx('admin-1'));

      expect(userRepo.findOne.mock.calls[0][0].lock).toEqual({
        mode: 'pessimistic_write',
      });
      expect(res.status).toBe('INACTIVE');
      expect(tokenRepo.update).toHaveBeenCalledTimes(1);
      expect(
        managerQuery.mock.calls.some(([sql]) =>
          String(sql).includes('auth_sessions'),
        ),
      ).toBe(true);
      expect(coreUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'u1', status: 'INACTIVE' }),
      );
      expect(audit.write).toHaveBeenCalledTimes(1);
      expect(audit.write.mock.calls[0][1].actionType).toBe('DEACTIVATE_USER');
    });

    it('không cho admin tự vô hiệu hóa chính mình', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ id: 'admin-1' }));
      await expect(
        service.deactivate('admin-1', ctx('admin-1')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    });

    it('activate không thu hồi token', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ status: 'INACTIVE' }));
      const res = await service.activate('u1', ctx());
      expect(res.status).toBe('ACTIVE');
      expect(tokenRepo.update).not.toHaveBeenCalled();
      expect(audit.write.mock.calls[0][1].actionType).toBe('ACTIVATE_USER');
    });

    it('tài khoản không tồn tại trả 404', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.activate('x', ctx())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('liên kết nhân viên', () => {
    it('link gọi link service trong transaction và ghi LINK_EMPLOYEE', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await service.linkEmployee('u1', 'e1', ctx());
      expect(links.apply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: 'u1' }),
        'e1',
      );
      expect(audit.write.mock.calls[0][1].actionType).toBe('LINK_EMPLOYEE');
    });

    it('unlink truyền null và ghi UNLINK_EMPLOYEE', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ employeeId: 'e1' }));
      await service.unlinkEmployee('u1', ctx());
      expect(links.apply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        null,
      );
      expect(audit.write.mock.calls[0][1].actionType).toBe('UNLINK_EMPLOYEE');
    });
  });

  describe('resetPassword', () => {
    it('đổi hash, đặt passwordChangedAt, thu hồi token, audit không chứa mật khẩu', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);

      await service.resetPassword('u1', { newPassword: 'NewSecret#99' }, ctx());

      const saved = userRepo.save.mock.calls[0][0] as UsersManagement;
      expect(saved.passwordHash).not.toBe('old-hash');
      await expect(
        verifyPassword('NewSecret#99', saved.passwordHash),
      ).resolves.toBe(true);
      expect(saved.passwordChangedAt).toBeInstanceOf(Date);
      expect(tokenRepo.update).toHaveBeenCalledTimes(1);
      expect(audit.write).toHaveBeenCalledTimes(1);
      const input = audit.write.mock.calls[0][1];
      expect(input.actionType).toBe('RESET_PASSWORD');
      expect(JSON.stringify(input)).not.toContain('NewSecret#99');
      expect(JSON.stringify(input)).not.toContain('passwordHash');
    });
  });

  it('vi phạm unique do đua request trả 409 thay vì 500', async () => {
    userRepo.findOne.mockResolvedValue(makeUser());
    userRepo.save.mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );
    await expect(service.activate('u1', ctx())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(audit.write).not.toHaveBeenCalled();
  });
});
