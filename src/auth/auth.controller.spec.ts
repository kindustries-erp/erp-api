import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DirectusAuthGuard } from './guards/directus-auth.guard';
import { ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      impersonate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn() } },
        DirectusAuthGuard,
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════
  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const loginResult = {
        message: 'Đăng nhập thành công',
        employee: null,
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires: 900000,
      };
      authService.login.mockResolvedValue(loginResult);

      const result = await controller.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual(loginResult);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should propagate UnauthorizedException from service', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Email hoặc mật khẩu không đúng'),
      );

      await expect(
        controller.login({ email: 'bad@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REFRESH
  // ═══════════════════════════════════════════════════════════════════
  describe('refresh', () => {
    it('should return new tokens on valid refresh token', async () => {
      const refreshResult = {
        message: 'Làm mới token thành công',
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires: 900000,
      };
      authService.refresh.mockResolvedValue(refreshResult);

      const result = await controller.refresh({
        refresh_token: 'valid-refresh',
      });

      expect(result).toEqual(refreshResult);
      expect(authService.refresh).toHaveBeenCalledWith('valid-refresh');
    });

    it('should propagate UnauthorizedException on invalid refresh token', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn'),
      );

      await expect(
        controller.refresh({ refresh_token: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════════════════════════════════
  describe('logout', () => {
    it('should return success on valid refresh token', async () => {
      authService.logout.mockResolvedValue({ message: 'Đăng xuất thành công' });

      const result = await controller.logout({
        refresh_token: 'valid-refresh',
      });

      expect(result).toEqual({ message: 'Đăng xuất thành công' });
      expect(authService.logout).toHaveBeenCalledWith('valid-refresh');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET PROFILE
  // ═══════════════════════════════════════════════════════════════════
  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const profileResult = {
        profile: {
          id: 'user-1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: { id: 'role-1', name: 'Admin' },
        },
        employee: { id: 'emp-1', full_name: 'Test User' },
        impersonation: { active: false },
        rolePermissions: [],
        customPermissions: [],
        effectivePermissions: [],
      };
      authService.getProfile.mockResolvedValue(profileResult);

      const req = {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'role-1',
        },
      };

      const result = await controller.getProfile(req);

      expect(result).toEqual(profileResult);
      expect(authService.getProfile).toHaveBeenCalledWith(req.user);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CHANGE PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  describe('changePassword', () => {
    it('should return success when password is changed', async () => {
      authService.changePassword.mockResolvedValue({
        message: 'Đổi mật khẩu thành công',
      });

      const req = { user: { id: 'user-1' } };
      const result = await controller.changePassword(req, {
        new_password: 'newPass123',
      });

      expect(result).toEqual({ message: 'Đổi mật khẩu thành công' });
      expect(authService.changePassword).toHaveBeenCalledWith('user-1', {
        new_password: 'newPass123',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IMPERSONATE
  // ═══════════════════════════════════════════════════════════════════
  describe('impersonate', () => {
    const req = {
      user: {
        id: 'admin-uuid',
        email: 'admin@example.com',
        role: 'role-admin',
      },
    };

    it('should return impersonation token when authorized', async () => {
      const impersonateResult = {
        message: 'Impersonation thành công',
        impersonation_token: 'imp-token-123',
        target_user: {
          id: 'target-uuid',
          email: 'target@example.com',
          first_name: 'Target',
          last_name: 'User',
        },
      };
      authService.impersonate.mockResolvedValue(impersonateResult);

      const result = await controller.impersonate(req, {
        target_user_id: 'target-uuid',
      });

      expect(result).toEqual(impersonateResult);
      expect(authService.impersonate).toHaveBeenCalledWith(
        req.user,
        'target-uuid',
      );
    });

    it('should propagate ForbiddenException when unauthorized', async () => {
      authService.impersonate.mockRejectedValue(
        new ForbiddenException('Bạn không có quyền đăng nhập thành user khác'),
      );

      await expect(
        controller.impersonate(req, { target_user_id: 'target-uuid' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate ForbiddenException on self-impersonate', async () => {
      authService.impersonate.mockRejectedValue(
        new ForbiddenException('Không thể impersonate chính mình'),
      );

      await expect(
        controller.impersonate(req, { target_user_id: req.user.id }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE PROFILE
  // ═══════════════════════════════════════════════════════════════════
  describe('updateProfile', () => {
    it('should update and return success', async () => {
      authService.updateProfile.mockResolvedValue({
        message: 'Cập nhật thông tin thành công',
        data: { id: 'emp-1', full_name: 'Updated Name' },
      });

      const req = { user: { id: 'user-1' } };
      const result = await controller.updateProfile(req, {
        full_name: 'Updated Name',
      });

      expect(result.message).toBe('Cập nhật thông tin thành công');
      expect(authService.updateProfile).toHaveBeenCalledWith('user-1', {
        full_name: 'Updated Name',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════
  describe('register', () => {
    it('should return user and tokens on successful registration', async () => {
      const registerResult = {
        message: 'Đăng ký thành công',
        user: {
          id: 'new-user',
          email: 'new@example.com',
          first_name: 'New',
          last_name: 'User',
        },
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires: 900000,
      };
      authService.register.mockResolvedValue(registerResult);

      const result = await controller.register({
        email: 'new@example.com',
        password: 'pass123',
        first_name: 'New',
        last_name: 'User',
      });

      expect(result).toEqual(registerResult);
    });
  });
});
