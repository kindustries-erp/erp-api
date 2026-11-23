import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditCoreService } from '../audit-core/audit-core.service';
import { ChangePasswordSelfDto } from '../users-admin/dto/user-admin.dto';
import { RbacAccessService } from '@/v2/core/rbac-core';
import {
  generateRefreshToken,
  hashToken,
  parseExpiresInSeconds,
  REFRESH_TOKEN_LIFETIME_SECONDS,
} from '@/v2/core/auth-core';
import { CreateUserDto } from '@/v2/modules/users-management/dto/create-user.dto';
import { UsersAuthService } from '@/v2/modules/users-management/services/users-auth.service';
import { UsersManagementService } from '@/v2/modules/users-management/users-management.service';
import { CoreRefreshToken } from './entities/core-refresh-token.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersAuthService,
    private readonly usersManagement: UsersManagementService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditCoreService: AuditCoreService,
    private readonly rbac: RbacAccessService,
    private readonly appConfigService: AppConfigService,
    @InjectRepository(CoreRefreshToken)
    private readonly refreshTokenRepo: Repository<CoreRefreshToken>,
  ) {}

  async onModuleInit() {
    const seedAdminEmail = this.configService.get<string>('SEED_ADMIN_EMAIL');
    const seedAdminPassword = this.configService.get<string>(
      'SEED_ADMIN_PASSWORD',
    );

    if (!seedAdminEmail || !seedAdminPassword) {
      return;
    }

    try {
      await this.usersService.ensureSeedUser(seedAdminEmail, seedAdminPassword);
    } catch {
      // Skip bootstrap failure here; DB may not be configured yet.
    }
  }

  // ── Refresh token helpers ─────────────────────────────────────────────────

  private async createRefreshToken(
    userId: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<string> {
    const raw = generateRefreshToken();
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_LIFETIME_SECONDS * 1000,
    );

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash,
        expiresAt,
        revokedAt: null,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
      }),
    );

    return raw;
  }

  private async findValidRefreshToken(
    raw: string,
  ): Promise<CoreRefreshToken | null> {
    const tokenHash = hashToken(raw);
    const record = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!record) return null;

    // Already revoked — potential reuse attack: revoke ALL tokens for user
    if (record.revokedAt !== null) {
      await this.revokeAllUserTokens(record.userId);
      return null;
    }

    // Expired
    if (record.expiresAt < new Date()) {
      return null;
    }

    return record;
  }

  async revokeToken(raw: string): Promise<void> {
    const tokenHash = hashToken(raw);
    await this.refreshTokenRepo.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, revokedAt: null as any },
      { revokedAt: new Date() },
    );
  }

  // ── Cleanup cron: remove expired tokens older than 7 days ─────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.delete({
      expiresAt: LessThan(cutoff),
    });
  }

  // ── Auth flows ─────────────────────────────────────────────────────────────

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ) {
    const normalizedEmail = email.toLowerCase().trim();
    const { user, valid } = await this.usersService.authenticate(
      normalizedEmail,
      password,
    );

    if (!user || !valid) {
      await this.auditCoreService.recordAction({
        actorEmail: normalizedEmail,
        actionType: 'LOGIN_FAIL',
        module: 'auth',
        entityType: 'core_user',
        entityId: user?.id ?? null,
        status: 'FAIL',
        message: 'Sai email hoặc mật khẩu',
      });
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    if (user.status !== 'ACTIVE') {
      await this.auditCoreService.recordAction({
        actorUserId: user.id,
        actorEmail: user.email,
        actorEmployeeId: user.employeeId,
        actionType: 'LOGIN_FAIL',
        module: 'auth',
        entityType: 'core_user',
        entityId: user.id,
        status: 'FAIL',
        message: 'User không ở trạng thái ACTIVE',
      });
      throw new UnauthorizedException(
        'Tài khoản đang bị khóa hoặc ngưng hoạt động',
      );
    }

    await this.usersService.recordLogin(user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status,
    });

    const refreshToken = await this.createRefreshToken(user.id, meta);

    await this.auditCoreService.recordAction({
      actorUserId: user.id,
      actorEmail: user.email,
      actorEmployeeId: user.employeeId,
      actionType: 'LOGIN_SUCCESS',
      module: 'auth',
      entityType: 'core_user',
      entityId: user.id,
      message: 'Đăng nhập thành công',
    });

    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = parseExpiresInSeconds(jwtExpiresIn);

    const preferences = await this.appConfigService.getUserPreferences(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        employeeId: user.employeeId,
      },
      preferences: {
        theme: preferences.theme,
        language: preferences.language,
        tableConfigs: preferences.tableConfigs,
        uiConfigs: preferences.uiConfigs,
      },
    };
  }

  async refresh(raw: string) {
    const record = await this.findValidRefreshToken(raw);
    if (!record) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    // Load user
    const user = await this.usersService.findById(record.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.revokeToken(raw);
      throw new UnauthorizedException('Tài khoản không hoạt động');
    }

    // Rotate: revoke old, issue new
    await this.refreshTokenRepo.update(
      { id: record.id },
      { revokedAt: new Date() },
    );

    const newRefreshToken = await this.createRefreshToken(user.id, {
      userAgent: record.userAgent ?? undefined,
      ipAddress: record.ipAddress ?? undefined,
    });

    const newAccessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status,
    });

    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = parseExpiresInSeconds(jwtExpiresIn);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires: expiresInSeconds,
    };
  }

  async logout(raw: string): Promise<{ message: string }> {
    await this.revokeToken(raw);
    return { message: 'Đăng xuất thành công' };
  }

  async registerLocalUser(input: {
    email: string;
    password: string;
    employeeId?: string;
  }) {
    const ctx = {
      actorUserId: null,
      actorEmail: null,
      route: '/api/v1/auth/register',
      httpMethod: 'POST',
      uiScreen: null,
      uiAction: null,
      ipAddress: null,
      userAgent: null,
      requestId: null,
    };
    const { data } = await this.usersManagement.create(
      Object.assign(new CreateUserDto(), input),
      ctx,
    );
    return {
      message: 'Tạo user local thành công',
      data: {
        id: data.id,
        email: data.email,
        status: data.status,
        employeeId: data.employeeId,
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const result = await this.usersService.updateOwnProfile(userId, {
      email: dto.email,
      fullName: dto.full_name,
      phone: dto.phone,
      notes: dto.notes,
    });
    if (!result) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const { user, employee } = result;
    return {
      message: 'Cập nhật hồ sơ thành công',
      data: {
        id: user.id,
        email: user.email,
        full_name: employee?.fullName ?? null,
        phone: employee?.phone ?? null,
        notes: employee?.notes ?? null,
      },
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordSelfDto,
    request: {
      user?: { sub?: string; email?: string };
      headers?: Record<string, unknown>;
      ip?: string;
      method?: string;
      originalUrl?: string;
    },
  ) {
    const result = await this.usersService.changeOwnPassword(
      userId,
      dto.oldPassword,
      dto.newPassword,
    );
    if (result.status === 'NOT_FOUND') {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const user = result.user;
    if (result.status === 'WRONG_PASSWORD') {
      await this.auditCoreService.recordAction({
        actorUserId: user.id,
        actorEmail: user.email,
        actorEmployeeId: user.employeeId,
        actionType: 'CHANGE_PASSWORD',
        module: 'auth',
        entityType: 'core_user',
        entityId: user.id,
        route: request.originalUrl ?? null,
        httpMethod: request.method ?? null,
        status: 'FAIL',
        message: 'Sai mật khẩu cũ',
        ipAddress: request.ip ?? null,
        userAgent: (request.headers?.['user-agent'] as string) ?? null,
        requestId: (request.headers?.['x-request-id'] as string) ?? null,
      });
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }

    await this.auditCoreService.recordAction({
      actorUserId: user.id,
      actorEmail: user.email,
      actorEmployeeId: user.employeeId,
      actionType: 'CHANGE_PASSWORD',
      module: 'auth',
      entityType: 'core_user',
      entityId: user.id,
      route: request.originalUrl ?? null,
      httpMethod: request.method ?? null,
      message: 'Đổi mật khẩu thành công',
      ipAddress: request.ip ?? null,
      userAgent: (request.headers?.['user-agent'] as string) ?? null,
      requestId: (request.headers?.['x-request-id'] as string) ?? null,
    });
    return { message: 'Đổi mật khẩu thành công' };
  }

  async impersonate(
    adminUserId: string,
    targetUserId: string,
    meta: { userAgent?: string; ipAddress?: string } = {},
  ) {
    const adminUser = await this.usersService.findById(adminUserId);
    if (adminUser?.email !== 'admin@liouni.com') {
      throw new UnauthorizedException(
        'Chỉ admin@liouni.com mới có quyền login as user',
      );
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      throw new UnauthorizedException('Không tìm thấy user đích');
    }

    if (targetUser.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Tài khoản đích đang bị khóa hoặc ngưng hoạt động',
      );
    }

    const accessToken = await this.jwtService.signAsync({
      sub: targetUser.id,
      email: targetUser.email,
      status: targetUser.status,
      impersonatorId: adminUser.id,
    });

    const refreshToken = await this.createRefreshToken(targetUser.id, meta);

    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '8h');
    const expiresInSeconds = parseExpiresInSeconds(jwtExpiresIn);

    await this.auditCoreService.recordAction({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      actorEmployeeId: adminUser.employeeId,
      actionType: 'IMPERSONATE',
      module: 'auth',
      entityType: 'core_user',
      entityId: targetUser.id,
      message: `Login as user ${targetUser.email}`,
    });

    const preferences = await this.appConfigService.getUserPreferences(
      targetUser.id,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      tokenType: 'Bearer',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        status: targetUser.status,
        employeeId: targetUser.employeeId,
      },
      preferences: {
        theme: preferences.theme,
        language: preferences.language,
        tableConfigs: preferences.tableConfigs,
        uiConfigs: preferences.uiConfigs,
      },
    };
  }

  async profile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const employee = await this.usersService.getEmployee(user.employeeId);

    const permissions = await this.rbac.getUserPermissions(user.id);
    const preferences = await this.appConfigService.getUserPreferences(user.id);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      employeeId: user.employeeId,
      employee: employee
        ? {
            id: employee.id,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            email: employee.email,
            phone: employee.phone,
            status: employee.status,
            userId: employee.userId,
          }
        : null,
      permissions: permissions.map((p) => ({
        resource: p.resource,
        action: p.action,
        conditions: p.conditions,
      })),
      preferences: {
        theme: preferences.theme,
        language: preferences.language,
        tableConfigs: preferences.tableConfigs,
        uiConfigs: preferences.uiConfigs,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
