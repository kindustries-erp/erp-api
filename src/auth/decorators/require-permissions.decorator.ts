import { SetMetadata } from '@nestjs/common';

export const RBAC_PERMISSIONS_KEY = 'rbac_permissions';

export interface RequiredPermission {
  resource: string;
  action: string;
}

/**
 * Đặt decorator này trên các Controller hoặc Route để yêu cầu quyền cụ thể.
 * Bạn có thể truyền nhiều quyền, người dùng chỉ cần có 1 trong các quyền (OR) hoặc tất cả (AND) tùy logic Guard.
 * Hiện tại CoreRbacGuard đang check AND cho tất cả các quyền truyền vào.
 */
export const RequirePermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(RBAC_PERMISSIONS_KEY, permissions);
