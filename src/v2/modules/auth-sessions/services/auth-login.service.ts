import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@/app-config/app-config.service';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import {
  parseExpiresInSeconds,
  TOKEN_TYPE_BEARER,
  type AuthClientMeta,
} from '@/v2/core/auth-core';
import { USER_STATUS_ACTIVE } from '@/v2/core/users-core';
import { UsersAuthService } from '../../users-management/services/users-auth.service';
import type { UsersManagement } from '../../users-management/entities/users-management.entity';
import type {
  LoginResultDto,
  RefreshResultDto,
} from '../dto/auth-response.dto';
import { toAuthUser, toPreferences } from '../helpers/auth.mapper';
import { SessionTokenService } from './session-token.service';
import { LegacyRefreshTokenExchange } from './legacy-refresh-token.exchange';

/** Chỉ tài khoản này được đăng nhập thay người khác (khớp v1). */
export const IMPERSONATOR_EMAIL = 'admin@liouni.com';

/** Đăng nhập, làm mới, đăng xuất và đăng nhập thay người dùng khác (auth v2). */
@Injectable()
export class AuthLoginService {
  constructor(
    private readonly users: UsersAuthService,
    private readonly sessions: SessionTokenService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditWriterService,
    private readonly appConfig: AppConfigService,
    private readonly legacyExchange: LegacyRefreshTokenExchange,
  ) {}

  async login(
    email: string,
    password: string,
    meta: AuthClientMeta = {},
  ): Promise<LoginResultDto> {
    const { user, valid } = await this.users.authenticate(email, password);
    if (!user || !valid) {
      await this.audit.recordAction({
        actorEmail: email.toLowerCase().trim(),
        actionType: 'LOGIN_FAIL',
        module: 'auth',
        entityType: 'users_management',
        entityId: user?.id ?? null,
        status: 'FAIL',
        message: 'Sai email hoặc mật khẩu',
      });
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }
    if (user.status !== USER_STATUS_ACTIVE) {
      await this.audit.recordAction({
        actorUserId: user.id,
        actorEmail: user.email,
        actorEmployeeId: user.employeeId,
        actionType: 'LOGIN_FAIL',
        module: 'auth',
        entityType: 'users_management',
        entityId: user.id,
        status: 'FAIL',
        message: 'User không ở trạng thái ACTIVE',
      });
      throw new UnauthorizedException(
        'Tài khoản đang bị khóa hoặc ngưng hoạt động',
      );
    }

    await this.users.recordLogin(user.id);
    const result = await this.issueLoginResult(user, meta);
    await this.audit.recordAction({
      actorUserId: user.id,
      actorEmail: user.email,
      actorEmployeeId: user.employeeId,
      actionType: 'LOGIN_SUCCESS',
      module: 'auth',
      entityType: 'users_management',
      entityId: user.id,
      message: 'Đăng nhập thành công',
    });
    return result;
  }

  /**
   * Xoay vòng refresh token. Token không có trong `auth_sessions` thì thử đổi từ token v1 một lần.
   * Không hợp lệ, hết hạn hoặc đã thu hồi: 401.
   */
  async refresh(raw: string): Promise<RefreshResultDto> {
    const next = await this.rotateOrExchange(raw);
    if (!next) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    const user = await this.users.findById(next.userId);
    if (!user || user.status !== USER_STATUS_ACTIVE) {
      await this.sessions.revoke(next.refreshToken);
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: next.refreshToken,
      expiresIn: this.accessTokenSeconds(),
      tokenType: TOKEN_TYPE_BEARER,
    };
  }

  private async rotateOrExchange(
    raw: string,
  ): Promise<{ userId: string; refreshToken: string } | null> {
    const rotated = await this.sessions.rotate(raw);
    if (rotated) {
      return {
        userId: rotated.previous.userId,
        refreshToken: rotated.refreshToken,
      };
    }
    const legacy = await this.legacyExchange.exchange(raw);
    if (!legacy) return null;
    const refreshToken = await this.sessions.issue(legacy.userId, {
      userAgent: legacy.userAgent ?? undefined,
      ipAddress: legacy.ipAddress ?? undefined,
    });
    return { userId: legacy.userId, refreshToken };
  }

  async logout(raw: string): Promise<void> {
    await this.sessions.revoke(raw);
  }

  async impersonate(
    adminUserId: string,
    targetUserId: string,
    meta: AuthClientMeta = {},
  ): Promise<LoginResultDto> {
    const admin = await this.users.findById(adminUserId);
    if (admin?.email !== IMPERSONATOR_EMAIL) {
      throw new UnauthorizedException(
        `Chỉ ${IMPERSONATOR_EMAIL} mới có quyền login as user`,
      );
    }
    const target = await this.users.findById(targetUserId);
    if (!target) throw new UnauthorizedException('Không tìm thấy user đích');
    if (target.status !== USER_STATUS_ACTIVE) {
      throw new UnauthorizedException(
        'Tài khoản đích đang bị khóa hoặc ngưng hoạt động',
      );
    }
    const result = await this.issueLoginResult(target, meta, admin.id);
    await this.audit.recordAction({
      actorUserId: admin.id,
      actorEmail: admin.email,
      actorEmployeeId: admin.employeeId,
      actionType: 'IMPERSONATE',
      module: 'auth',
      entityType: 'users_management',
      entityId: target.id,
      message: `Login as user ${target.email}`,
    });
    return result;
  }

  private async issueLoginResult(
    user: UsersManagement,
    meta: AuthClientMeta,
    impersonatorId?: string,
  ): Promise<LoginResultDto> {
    const accessToken = await this.signAccessToken(user, impersonatorId);
    const refreshToken = await this.sessions.issue(user.id, meta);
    const preferences = await this.appConfig.getUserPreferences(user.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenSeconds(),
      tokenType: TOKEN_TYPE_BEARER,
      user: toAuthUser(user),
      preferences: toPreferences(preferences),
    };
  }

  /** Payload dùng chung với v1 (`sub`, `email`, `status`) để guard và RBAC không đổi. */
  private signAccessToken(
    user: UsersManagement,
    impersonatorId?: string,
  ): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status,
      ...(impersonatorId ? { impersonatorId } : {}),
    });
  }

  private accessTokenSeconds(): number {
    return parseExpiresInSeconds(
      this.config.get<string>('JWT_EXPIRES_IN', '8h'),
    );
  }
}
