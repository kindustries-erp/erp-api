import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { DIRECTUS_CLIENT } from '../directus/directus.provider';

// ─── Global fetch mock ───────────────────────────────────────────────
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// ─── Mock @directus/sdk to prevent real client creation ──────────────
jest.mock('@directus/sdk', () => ({
  createDirectus: jest.fn(() => ({
    with: jest.fn().mockReturnThis(),
    login: jest.fn(),
    request: jest.fn(),
  })),
  rest: jest.fn(),
  authentication: jest.fn(),
  staticToken: jest.fn(),
  createUser: jest.fn((data: any) => ({ type: 'createUser', data })),
  readUsers: jest.fn((opts: any) => ({ type: 'readUsers', opts })),
  readMe: jest.fn((opts: any) => ({ type: 'readMe', opts })),
  readItems: jest.fn((collection: string, opts: any) => ({
    type: 'readItems',
    collection,
    opts,
  })),
  updateUser: jest.fn((id: string, data: any) => ({
    type: 'updateUser',
    id,
    data,
  })),
  updateItem: jest.fn((collection: string, id: string, data: any) => ({
    type: 'updateItem',
    collection,
    id,
    data,
  })),
}));

describe('AuthService', () => {
  let service: AuthService;
  let configService: ConfigService;
  let jwtService: JwtService;
  let directusClient: any;

  const mockConfigValues: Record<string, string> = {
    DIRECTUS_URL: 'http://localhost:8055',
    DIRECTUS_ADMIN_TOKEN: 'admin-token-123',
    JWT_IMPERSONATION_SECRET: 'test-secret',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFetch.mockReset();

    directusClient = {
      request: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DIRECTUS_CLIENT,
          useValue: directusClient,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (mockConfigValues[key]) return mockConfigValues[key];
              throw new Error(`Config key ${key} not found`);
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-impersonation-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
    jwtService = module.get<JwtService>(JwtService);
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════
  describe('login', () => {
    it('should return tokens and employee data on valid credentials', async () => {
      // Mock createDirectus().login() via the SDK mock
      const { createDirectus } = require('@directus/sdk');
      const mockAuthClient = {
        with: jest.fn().mockReturnThis(),
        login: jest.fn().mockResolvedValue({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires: 900000,
        }),
        request: jest.fn(),
      };
      createDirectus.mockReturnValue(mockAuthClient);

      // Mock readMe and readItems for employee lookup
      mockAuthClient.request
        .mockResolvedValueOnce({ id: 'user-1', email: 'test@example.com' }) // readMe
        .mockResolvedValueOnce([
          {
            id: 'emp-1',
            full_name: 'Test User',
            department_id: { name: 'IT' },
          },
        ]); // readItems (employees)

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        message: 'Đăng nhập thành công',
        employee: {
          id: 'emp-1',
          full_name: 'Test User',
          department_id: { name: 'IT' },
        },
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires: 900000,
      });
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAuthClient = {
        with: jest.fn().mockReturnThis(),
        login: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
      };
      createDirectus.mockReturnValue(mockAuthClient);

      await expect(
        service.login({ email: 'bad@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should still return tokens even if employee lookup fails', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAuthClient = {
        with: jest.fn().mockReturnThis(),
        login: jest.fn().mockResolvedValue({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires: 900000,
        }),
        request: jest.fn().mockRejectedValue(new Error('Network error')),
      };
      createDirectus.mockReturnValue(mockAuthClient);

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.access_token).toBe('access-123');
      expect(result.employee).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REFRESH TOKEN
  // ═══════════════════════════════════════════════════════════════════
  describe('refresh', () => {
    it('should return new tokens on valid refresh token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            access_token: 'new-access-789',
            refresh_token: 'new-refresh-012',
            expires: 900000,
          },
        }),
      });

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        message: 'Làm mới token thành công',
        access_token: 'new-access-789',
        refresh_token: 'new-refresh-012',
        expires: 900000,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8055/auth/refresh',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: 'valid-refresh-token',
            mode: 'json',
          }),
        },
      );
    });

    it('should throw UnauthorizedException on expired/invalid refresh token', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════
  describe('logout', () => {
    it('should return success message on valid refresh token', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const result = await service.logout('valid-refresh-token');

      expect(result).toEqual({ message: 'Đăng xuất thành công' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8055/auth/logout',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
        },
      );
    });

    it('should still return success even if Directus returns non-ok (graceful logout)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const result = await service.logout('expired-token');

      expect(result).toEqual({ message: 'Đăng xuất thành công' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IMPERSONATE
  // ═══════════════════════════════════════════════════════════════════
  describe('impersonate', () => {
    const caller = {
      id: 'caller-uuid',
      email: 'admin@example.com',
      role: 'role-admin-uuid',
    };

    const targetUserId = 'target-uuid';

    function setupImpersonateMocks(options: {
      hasPermission?: boolean;
      targetUser?: any;
    }) {
      const { hasPermission = true, targetUser } = options;

      // Build fetch responses in order:
      // 1. GET /access?filter[role]... → role access
      // 2. GET /permissions?... → role permissions
      // 3. GET /access?filter[user]... → user access
      // 4. GET /users/{targetUserId}... → target user
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/access?filter[role]')) {
          return {
            ok: true,
            json: async () => ({
              data: [{ policy: 'policy-1' }],
            }),
          };
        }
        if (url.includes('/permissions') && url.includes('policy-1')) {
          if (hasPermission) {
            return {
              ok: true,
              json: async () => ({
                data: [
                  { action: 'read', collection: 'directus_roles' },
                  { action: 'create', collection: 'directus_roles' },
                  { action: 'update', collection: 'directus_roles' },
                  { action: 'delete', collection: 'directus_roles' },
                ],
              }),
            };
          }
          return {
            ok: true,
            json: async () => ({ data: [{ action: 'read' }] }),
          };
        }
        if (url.includes('/access?filter[user]')) {
          return {
            ok: true,
            json: async () => ({ data: [] }),
          };
        }
        if (url.includes(`/users/${targetUserId}`)) {
          if (targetUser) {
            return {
              ok: true,
              json: async () => ({ data: targetUser }),
            };
          }
          return { ok: false };
        }
        return { ok: true, json: async () => ({ data: null }) };
      });
    }

    it('should return impersonation token when caller has full CRUD on directus_roles', async () => {
      setupImpersonateMocks({
        hasPermission: true,
        targetUser: {
          id: targetUserId,
          email: 'target@example.com',
          first_name: 'Target',
          last_name: 'User',
          role: 'role-user',
          status: 'active',
        },
      });

      const result = await service.impersonate(caller, targetUserId);

      expect(result.message).toBe('Impersonation thành công');
      expect(result.impersonation_token).toBe('mock-impersonation-token');
      expect(result.target_user).toEqual({
        id: targetUserId,
        email: 'target@example.com',
        first_name: 'Target',
        last_name: 'User',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          type: 'impersonation',
          sub: targetUserId,
          originalUserId: caller.id,
        },
        { secret: 'test-secret', expiresIn: '8h' },
      );
    });

    it('should throw ForbiddenException when caller lacks permissions', async () => {
      setupImpersonateMocks({ hasPermission: false });

      await expect(
        service.impersonate(caller, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to impersonate self', async () => {
      setupImpersonateMocks({ hasPermission: true });

      await expect(
        service.impersonate(caller, caller.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when target user is not found', async () => {
      setupImpersonateMocks({
        hasPermission: true,
        targetUser: null,
      });

      await expect(
        service.impersonate(caller, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when target user is not active', async () => {
      setupImpersonateMocks({
        hasPermission: true,
        targetUser: {
          id: targetUserId,
          email: 'target@example.com',
          first_name: 'Target',
          last_name: 'User',
          role: 'role-user',
          status: 'suspended',
        },
      });

      await expect(
        service.impersonate(caller, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  describe('changePassword', () => {
    it('should return success message when password is changed', async () => {
      directusClient.request.mockResolvedValue({});

      const result = await service.changePassword('user-1', {
        new_password: 'newPass123',
      });

      expect(result).toEqual({ message: 'Đổi mật khẩu thành công' });
      expect(directusClient.request).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when Directus fails', async () => {
      directusClient.request.mockRejectedValue(new Error('Directus error'));

      await expect(
        service.changePassword('user-1', { new_password: 'newPass123' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET PROFILE
  // ═══════════════════════════════════════════════════════════════════
  describe('getProfile', () => {
    const user = {
      id: 'user-1',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      role: 'role-1',
    };

    beforeEach(() => {
      // Mock the admin fetch calls for getProfile
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/roles/role-1')) {
          return {
            ok: true,
            json: async () => ({
              data: { id: 'role-1', name: 'Admin', icon: null, description: null },
            }),
          };
        }
        if (url.includes('/access?filter[role]')) {
          return {
            ok: true,
            json: async () => ({
              data: [{ policy: 'policy-role-1' }],
            }),
          };
        }
        if (url.includes('policy-role-1')) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  collection: 'employees',
                  action: 'read',
                  fields: ['*'],
                  permissions: null,
                  validation: null,
                },
              ],
            }),
          };
        }
        if (url.includes('/access?filter[user]')) {
          return {
            ok: true,
            json: async () => ({ data: [] }),
          };
        }
        return { ok: true, json: async () => ({ data: null }) };
      });
    });

    it('should return profile with role and permissions', async () => {
      // Mock getProfileEmployee (uses directus SDK internally)
      const { createDirectus } = require('@directus/sdk');
      const mockAdminClient = {
        with: jest.fn().mockReturnThis(),
        request: jest.fn().mockResolvedValue([
          { id: 'emp-1', full_name: 'Test User', department_id: { name: 'IT' } },
        ]),
      };
      createDirectus.mockReturnValue(mockAdminClient);

      const result = await service.getProfile(user);

      expect(result.profile.id).toBe('user-1');
      expect(result.profile.email).toBe('test@example.com');
      expect(result.profile.role).toEqual({
        id: 'role-1',
        name: 'Admin',
        icon: null,
        description: null,
      });
      expect(result.employee).toEqual({
        id: 'emp-1',
        full_name: 'Test User',
        department_id: { name: 'IT' },
      });
      expect(result.rolePermissions).toBeInstanceOf(Array);
      expect(result.impersonation.active).toBe(false);
    });

    it('should include impersonation metadata when _impersonatedBy is set', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAdminClient = {
        with: jest.fn().mockReturnThis(),
        request: jest.fn().mockResolvedValue([]),
      };
      createDirectus.mockReturnValue(mockAdminClient);

      // Override fetch to also handle the actor lookup
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/users/actor-uuid')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                id: 'actor-uuid',
                email: 'actor@example.com',
                first_name: 'Actor',
                last_name: 'Admin',
              },
            }),
          };
        }
        if (url.includes('/access')) {
          return { ok: true, json: async () => ({ data: [] }) };
        }
        if (url.includes('/roles/')) {
          return { ok: true, json: async () => ({ data: null }) };
        }
        return { ok: true, json: async () => ({ data: null }) };
      });

      const impersonatedUser = {
        ...user,
        _impersonatedBy: 'actor-uuid',
      };

      const result = await service.getProfile(impersonatedUser);

      expect(result.impersonation.active).toBe(true);
      expect(result.impersonation.actor).toEqual({
        id: 'actor-uuid',
        email: 'actor@example.com',
        first_name: 'Actor',
        last_name: 'Admin',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE PROFILE
  // ═══════════════════════════════════════════════════════════════════
  describe('updateProfile', () => {
    it('should update employee profile fields', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAdminClient = {
        with: jest.fn().mockReturnThis(),
        request: jest
          .fn()
          .mockResolvedValueOnce([{ id: 'emp-1' }]) // readItems (find employee)
          .mockResolvedValueOnce({ id: 'emp-1', full_name: 'New Name' }), // updateItem
      };
      createDirectus.mockReturnValue(mockAdminClient);

      const result = await service.updateProfile('user-1', {
        full_name: 'New Name',
      });

      expect(result.message).toBe('Cập nhật thông tin thành công');
    });

    it('should throw when no employee record found', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAdminClient = {
        with: jest.fn().mockReturnThis(),
        request: jest.fn().mockResolvedValue([]), // empty employees
      };
      createDirectus.mockReturnValue(mockAdminClient);

      await expect(
        service.updateProfile('user-1', { full_name: 'New Name' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw when no fields provided', async () => {
      const { createDirectus } = require('@directus/sdk');
      const mockAdminClient = {
        with: jest.fn().mockReturnThis(),
        request: jest.fn().mockResolvedValue([{ id: 'emp-1' }]),
      };
      createDirectus.mockReturnValue(mockAdminClient);

      await expect(
        service.updateProfile('user-1', {}),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════
  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      directusClient.request.mockResolvedValue([{ id: 'existing-user' }]);

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'pass123',
          first_name: 'Test',
          last_name: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and return tokens on success', async () => {
      // First call: readUsers → empty (no existing user)
      // Second call: createUser → new user
      directusClient.request
        .mockResolvedValueOnce([]) // readUsers
        .mockResolvedValueOnce({
          id: 'new-user-id',
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'User',
        }); // createUser

      // Mock _directusLogin via createDirectus
      const { createDirectus } = require('@directus/sdk');
      const mockAuthClient = {
        with: jest.fn().mockReturnThis(),
        login: jest.fn().mockResolvedValue({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires: 900000,
        }),
        request: jest.fn().mockRejectedValue(new Error('skip employee')),
      };
      createDirectus.mockReturnValue(mockAuthClient);

      const result = await service.register({
        email: 'new@example.com',
        password: 'pass123',
        first_name: 'New',
        last_name: 'User',
      });

      expect(result.message).toBe('Đăng ký thành công');
      expect(result.user.email).toBe('new@example.com');
      expect(result.access_token).toBe('new-access');
      expect(result.refresh_token).toBe('new-refresh');
    });
  });
});
