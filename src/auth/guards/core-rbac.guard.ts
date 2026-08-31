import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacCoreService } from '@/rbac-core/rbac-core.service';
import {
  RequiredPermission,
  RBAC_PERMISSIONS_KEY,
  RBAC_ANY_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

@Injectable()
export class CoreRbacGuard implements CanActivate {
  private readonly logger = new Logger(CoreRbacGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacCoreService: RbacCoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(RBAC_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    const requiredAnyPermissions = this.reflector.getAllAndOverride<
      RequiredPermission[]
    >(RBAC_ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    const hasAndPerms = requiredPermissions && requiredPermissions.length > 0;
    const hasOrPerms =
      requiredAnyPermissions && requiredAnyPermissions.length > 0;

    if (!hasAndPerms && !hasOrPerms) {
      return true; // Nếu không yêu cầu quyền gì, cho phép qua
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      this.logger.warn('CoreRbacGuard: User không tồn tại trong request');
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const userId = user.sub;

    // 1. Check tất cả các quyền bắt buộc (AND logic)
    if (hasAndPerms) {
      const hasAll = await this.rbacCoreService.hasAllPermissions(
        userId,
        requiredPermissions,
      );
      if (!hasAll) {
        this.logger.warn(
          `User ${userId} bị từ chối quyền bắt buộc: ${JSON.stringify(requiredPermissions)}`,
        );
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện thao tác này',
        );
      }
    }

    // 2. Check ít nhất 1 trong các quyền (OR logic)
    if (hasOrPerms) {
      const hasAny = await this.rbacCoreService.hasAnyPermission(
        userId,
        requiredAnyPermissions,
      );
      if (!hasAny) {
        this.logger.warn(
          `User ${userId} không có quyền nào trong danh sách: ${JSON.stringify(requiredAnyPermissions)}`,
        );
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện thao tác này',
        );
      }
    }

    return true;
  }
}
