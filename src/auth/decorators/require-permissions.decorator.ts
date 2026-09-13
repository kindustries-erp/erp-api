import { SetMetadata } from '@nestjs/common';
import { ErpResource, ErpAction } from '@/rbac-core/enums';

export const RBAC_PERMISSIONS_KEY = 'rbac_permissions';
export const RBAC_ANY_PERMISSIONS_KEY = 'rbac_any_permissions';

export interface RequiredPermission {
  resource: ErpResource | string;
  action: ErpAction | string;
}

/**
 * Đặt decorator này trên các Controller hoặc Route để yêu cầu quyền cụ thể (AND cho tất cả).
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(RBAC_PERMISSIONS_KEY, permissions);

/**
 * Đặt decorator này trên các Route để yêu cầu người dùng có ÍT NHẤT 1 trong các quyền (OR).
 */
export const RequireAnyPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(RBAC_ANY_PERMISSIONS_KEY, permissions);
