import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditCoreService } from '../audit-core/audit-core.service';
import { ChangePasswordSelfDto } from '../users-admin/dto/user-admin.dto';
import { RbacCoreService } from '../rbac-core/rbac-core.service';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditCoreService: AuditCoreService,
    private readonly rbacCoreService: RbacCoreService,
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
      await this.usersService.createSeedUserIfMissing(
        seedAdminEmail,
        seedAdminPassword,
      );
    } catch {
      // Skip bootstrap failure here; DB may not be configured yet.
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (
      !user ||
      !this.usersService.verifyPassword(password, user.passwordHash)
    ) {
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

    user.lastLoginAt = new Date();
    await this.usersService.updateLastLogin(user.id);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      status: user.status,
    });

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

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        employeeId: user.employeeId,
        legacyDirectusUserId: user.legacyDirectusUserId,
      },
    };
  }

  async registerLocalUser(input: {
    email: string;
    password: string;
    employeeId?: string;
  }) {
    return this.usersService.registerLocalUser(input);
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
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    if (!this.usersService.verifyPassword(dto.oldPassword, user.passwordHash)) {
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

    user.passwordHash = this.usersService.hashPassword(dto.newPassword);
    user.passwordChangedAt = new Date();
    await this.usersService.save(user as any);
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

  async impersonate(adminUserId: string, targetUserId: string) {
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

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: targetUser.id,
        email: targetUser.email,
        status: targetUser.status,
        employeeId: targetUser.employeeId,
        legacyDirectusUserId: targetUser.legacyDirectusUserId,
      },
    };
  }

  async profile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const employee = await this.usersService.getEmployeeSnapshot(
      user.employeeId,
    );

    const permissions = await this.rbacCoreService.getUserPermissions(user.id);

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      employeeId: user.employeeId,
      legacyDirectusUserId: user.legacyDirectusUserId,
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
