import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { UsersAuthService } from '@/v2/modules/users-management/services/users-auth.service';
import { UsersManagementService } from '@/v2/modules/users-management/users-management.service';
import { CoreRefreshToken } from './entities/core-refresh-token.entity';
import { AuditCoreService } from '../audit-core/audit-core.service';
import { RbacCoreService } from '@/v2/core/rbac-core';
import { AppConfigService } from '../app-config/app-config.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    ensureSeedUser: jest.Mock;
    authenticate: jest.Mock;
    recordLogin: jest.Mock;
    changeOwnPassword: jest.Mock;
    updateOwnProfile: jest.Mock;
    getEmployee: jest.Mock;
  };
  let usersManagement: { create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let auditCoreService: { recordAction: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      ensureSeedUser: jest.fn().mockResolvedValue(undefined),
      authenticate: jest.fn(),
      recordLogin: jest.fn().mockResolvedValue(new Date()),
      changeOwnPassword: jest.fn(),
      updateOwnProfile: jest.fn(),
      getEmployee: jest.fn().mockResolvedValue(null),
    };
    usersManagement = { create: jest.fn() };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-access-token'),
    };

    auditCoreService = {
      recordAction: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersAuthService, useValue: usersService },
        { provide: UsersManagementService, useValue: usersManagement },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditCoreService, useValue: auditCoreService },
        {
          provide: RbacCoreService,
          useValue: { getUserPermissions: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: AppConfigService,
          useValue: {
            getPublicConfig: jest.fn().mockReturnValue({
              appEnv: 'development',
              appName: 'ERP',
              version: '1.0.0',
            }),
            getUserPreferences: jest.fn().mockResolvedValue({
              theme: 'classic',
              language: 'vi',
              tableConfigs: {},
              uiConfigs: {},
            }),
            updateUserPreferences: jest.fn().mockResolvedValue({
              theme: 'classic',
              language: 'vi',
              tableConfigs: {},
              uiConfigs: {},
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
            getOrThrow: jest.fn().mockReturnValue('mock'),
          },
        },
        {
          provide: getRepositoryToken(CoreRefreshToken),
          useValue: {
            create: jest.fn().mockImplementation((v) => v),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const activeUser = {
      id: 'u1',
      email: 'test@example.com',
      passwordHash: 'hashed',
      status: 'ACTIVE',
      employeeId: null,
      legacyDirectusUserId: null,
    };

    it('should return accessToken and user on valid credentials, ghi lastLoginAt đúng một lần', async () => {
      usersService.authenticate.mockResolvedValue({
        user: activeUser,
        valid: true,
      });

      const result = await service.login('Test@Example.com', 'password123');

      expect(result.accessToken).toBe('mocked-access-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('test@example.com');
      expect(usersService.authenticate).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(usersService.recordLogin).toHaveBeenCalledTimes(1);
      expect(usersService.recordLogin).toHaveBeenCalledWith('u1');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      usersService.authenticate.mockResolvedValue({ user: null, valid: false });

      await expect(
        service.login('bad@example.com', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.recordLogin).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      usersService.authenticate.mockResolvedValue({
        user: activeUser,
        valid: false,
      });

      await expect(
        service.login('test@example.com', 'wrongpass'),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.recordLogin).not.toHaveBeenCalled();
    });

    it('should reject INACTIVE account', async () => {
      usersService.authenticate.mockResolvedValue({
        user: { ...activeUser, status: 'INACTIVE' },
        valid: true,
      });

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow('Tài khoản đang bị khóa');
    });
  });

  describe('registerLocalUser', () => {
    it('ủy quyền sang UsersManagementService.create và giữ hợp đồng v1', async () => {
      const payload = {
        email: 'new@example.com',
        password: 'pass1234',
        employeeId: 'emp-1',
      };
      usersManagement.create.mockResolvedValue({
        message: 'Tạo tài khoản thành công',
        data: {
          id: 'u2',
          email: payload.email,
          status: 'ACTIVE',
          employeeId: 'emp-1',
          legacyDirectusUserId: null,
          passwordHash: 'must-not-leak',
        },
      });

      const result = await service.registerLocalUser(payload);

      expect(result).toEqual({
        message: 'Tạo user local thành công',
        data: {
          id: 'u2',
          email: payload.email,
          status: 'ACTIVE',
          employeeId: 'emp-1',
          legacyDirectusUserId: null,
        },
      });
      expect(usersManagement.create).toHaveBeenCalledWith(
        expect.objectContaining(payload),
        expect.objectContaining({ actorUserId: null }),
      );
    });
  });

  describe('profile', () => {
    it('should return user profile with null employee when no employee linked', async () => {
      usersService.findById.mockResolvedValue({
        id: 'u1',
        email: 'test@example.com',
        status: 'ACTIVE',
        employeeId: null,
        legacyDirectusUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.profile('u1');

      expect(result.id).toBe('u1');
      expect(result.employee).toBeNull();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.profile('not-exist')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('ánh xạ snake_case v1 sang service và trả lại hợp đồng v1', async () => {
      usersService.updateOwnProfile.mockResolvedValue({
        user: { id: 'u1', email: 'new@example.com' },
        employee: {
          fullName: 'New Name',
          phone: '0909123456',
          notes: 'updated',
        },
      });

      const result = await service.updateProfile('u1', {
        email: 'new@example.com',
        full_name: 'New Name',
        phone: '0909123456',
        notes: 'updated',
      });

      expect(usersService.updateOwnProfile).toHaveBeenCalledWith('u1', {
        email: 'new@example.com',
        fullName: 'New Name',
        phone: '0909123456',
        notes: 'updated',
      });
      expect(result).toEqual({
        message: 'Cập nhật hồ sơ thành công',
        data: {
          id: 'u1',
          email: 'new@example.com',
          full_name: 'New Name',
          phone: '0909123456',
          notes: 'updated',
        },
      });
    });

    it('should throw 401 when user no longer exists', async () => {
      usersService.updateOwnProfile.mockResolvedValue(null);
      await expect(service.updateProfile('u1', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('propagates conflict from the service', async () => {
      usersService.updateOwnProfile.mockRejectedValue(
        new Error('Email đã tồn tại'),
      );
      await expect(
        service.updateProfile('u1', { email: 'taken@example.com' }),
      ).rejects.toThrow('Email đã tồn tại');
    });
  });

  describe('changePassword', () => {
    const user = { id: 'u1', email: 'a@x.com', employeeId: null };
    const req = { headers: {}, ip: '1.1.1.1' };

    it('thành công: ghi audit', async () => {
      usersService.changeOwnPassword.mockResolvedValue({ status: 'OK', user });
      await expect(
        service.changePassword(
          'u1',
          { oldPassword: 'o', newPassword: 'n1234567' },
          req,
        ),
      ).resolves.toEqual({ message: 'Đổi mật khẩu thành công' });
      expect(auditCoreService.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ actionType: 'CHANGE_PASSWORD' }),
      );
    });

    it('sai mật khẩu cũ: 401 và audit FAIL', async () => {
      usersService.changeOwnPassword.mockResolvedValue({
        status: 'WRONG_PASSWORD',
        user,
      });
      await expect(
        service.changePassword(
          'u1',
          { oldPassword: 'x', newPassword: 'n1234567' },
          req,
        ),
      ).rejects.toThrow('Mật khẩu cũ không đúng');
      expect(auditCoreService.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAIL' }),
      );
    });

    it('không thấy user: 401', async () => {
      usersService.changeOwnPassword.mockResolvedValue({
        status: 'NOT_FOUND',
        user: null,
      });
      await expect(
        service.changePassword(
          'u1',
          { oldPassword: 'x', newPassword: 'n1234567' },
          req,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
