import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CoreUserRole } from '../entities/core-user-role.entity';
import { CorePermission } from '../entities/core-permission.entity';
import { checkPermissionMatch } from '../helpers/permission-match.helper';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

/**
 * Engine kiểm quyền dùng chung toàn hệ thống (lõi họ rbac).
 * Guard, auth và các module khác inject class này. Không chứa nghiệp vụ quản trị role.
 */
@Injectable()
export class RbacCoreService {
  private readonly logger = new Logger(RbacCoreService.name);

  constructor(
    @InjectRepository(CoreUserRole)
    private readonly userRoleRepository: Repository<CoreUserRole>,
  ) {}

  async hasPermission(
    userId: string,
    resource: ErpResource | string,
    action: ErpAction | string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return checkPermissionMatch(permissions, resource, action);
  }

  async hasAnyPermission(
    userId: string,
    requiredPermissions: Array<{
      resource: ErpResource | string;
      action: ErpAction | string;
    }>,
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const permissions = await this.getUserPermissions(userId);
    return requiredPermissions.some((req) =>
      checkPermissionMatch(permissions, req.resource, req.action),
    );
  }

  async hasAllPermissions(
    userId: string,
    requiredPermissions: Array<{
      resource: ErpResource | string;
      action: ErpAction | string;
    }>,
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const permissions = await this.getUserPermissions(userId);
    return requiredPermissions.every((req) =>
      checkPermissionMatch(permissions, req.resource, req.action),
    );
  }

  /** Tên các role đang hoạt động của người dùng, dùng để ghi nhật ký duyệt. */
  async getUserRoleNames(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });
    return userRoles
      .map((ur) => ur.role)
      .filter((role) => role?.isActive)
      .map((role) => role.name);
  }

  async getUserPermissions(userId: string): Promise<CorePermission[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role', 'role.permissions'],
    });

    const activeRoles = userRoles
      .map((ur) => ur.role)
      .filter((role) => role.isActive);

    const permissions: CorePermission[] = [];
    for (const role of activeRoles) {
      if (role.permissions) {
        permissions.push(...role.permissions);
      }
    }

    const uniquePermissionsMap = new Map<string, CorePermission>();
    for (const p of permissions) {
      const key = `${p.resource}:${p.action}`;
      if (!uniquePermissionsMap.has(key)) {
        uniquePermissionsMap.set(key, p);
      }
    }

    return Array.from(uniquePermissionsMap.values());
  }
}
