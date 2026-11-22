import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AppConfigService } from '@/app-config/app-config.service';
import { AuditWriterService } from '@/v2/modules/audit-logs/services/audit-writer.service';
import { RbacCoreService } from '@/v2/core/rbac-core';
import { UsersAuthService } from '../../users-management/services/users-auth.service';
import type { UpdateProfileDto } from '../dto/update-profile.dto';
import type { ProfileDto, UpdatedProfileDto } from '../dto/auth-response.dto';
import {
  toAuthUser,
  toPreferences,
  toProfileEmployee,
} from '../helpers/auth.mapper';

export interface AuthRequestMeta {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  route?: string;
  method?: string;
}

/** Hồ sơ cá nhân và đổi mật khẩu của chính người dùng (auth v2). */
@Injectable()
export class AuthProfileService {
  constructor(
    private readonly users: UsersAuthService,
    private readonly rbac: RbacCoreService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditWriterService,
  ) {}

  async profile(userId: string): Promise<ProfileDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Token không hợp lệ');
    const [employee, permissions, preferences] = await Promise.all([
      this.users.getEmployee(user.employeeId),
      this.rbac.getUserPermissions(user.id),
      this.appConfig.getUserPreferences(user.id),
    ]);
    return {
      ...toAuthUser(user),
      employee: employee ? toProfileEmployee(employee) : null,
      permissions: permissions.map((p) => ({
        resource: p.resource,
        action: p.action,
        conditions: p.conditions,
      })),
      preferences: toPreferences(preferences),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UpdatedProfileDto> {
    const result = await this.users.updateOwnProfile(userId, dto);
    if (!result) throw new UnauthorizedException('Token không hợp lệ');
    return {
      id: result.user.id,
      email: result.user.email,
      fullName: result.employee?.fullName ?? null,
      phone: result.employee?.phone ?? null,
      notes: result.employee?.notes ?? null,
    };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
    meta: AuthRequestMeta = {},
  ): Promise<void> {
    const result = await this.users.changeOwnPassword(
      userId,
      oldPassword,
      newPassword,
    );
    if (result.status === 'NOT_FOUND') {
      throw new UnauthorizedException('Token không hợp lệ');
    }
    const user = result.user;
    const base = {
      actorUserId: user.id,
      actorEmail: user.email,
      actorEmployeeId: user.employeeId,
      actionType: 'CHANGE_PASSWORD',
      module: 'auth',
      entityType: 'users_management',
      entityId: user.id,
      route: meta.route ?? null,
      httpMethod: meta.method ?? null,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      requestId: meta.requestId ?? null,
    };
    if (result.status === 'WRONG_PASSWORD') {
      await this.audit.recordAction({
        ...base,
        status: 'FAIL',
        message: 'Sai mật khẩu cũ',
      });
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }
    await this.audit.recordAction({
      ...base,
      message: 'Đổi mật khẩu thành công',
    });
  }
}
