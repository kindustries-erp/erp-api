import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacCoreService } from '../../rbac-core/rbac-core.service';
import {
  RequiredPermission,
  RBAC_PERMISSIONS_KEY,
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

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // Nếu không yêu cầu quyền gì, cho phép qua
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      this.logger.warn('CoreRbacGuard: User không tồn tại trong request');
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    const userId = user.sub;

    // Check tất cả các quyền yêu cầu
    for (const requiredPerm of requiredPermissions) {
      const hasPerm = await this.rbacCoreService.hasPermission(
        userId,
        requiredPerm.resource,
        requiredPerm.action,
      );

      if (!hasPerm) {
        this.logger.warn(
          `User ${userId} bị từ chối quyền ${requiredPerm.action} trên ${requiredPerm.resource}`,
        );
        throw new ForbiddenException(
          `Bạn không có quyền ${requiredPerm.action} trên ${requiredPerm.resource}`,
        );
      }
    }

    return true;
  }
}
