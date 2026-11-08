import type { CoreRole } from '@/v2/core/rbac-core/entities/core-role.entity';
import type { CorePermission } from '@/v2/core/rbac-core/entities/core-permission.entity';
import type { CoreUser } from '@/users/entities/core-user.entity';
import type {
  PermissionResponse,
  RoleListItemResponse,
  RoleResponse,
  RoleUserResponse,
} from '../dto/rbac-response.dto';

/** Chỉ lộ id và email của người dùng; không trả password_hash hay các cột khác. */
export function toRoleUser(
  user: Pick<CoreUser, 'id' | 'email'> | null | undefined,
): RoleUserResponse {
  return { id: user?.id as string, email: user?.email as string };
}

/** Dòng danh sách role: giữ tên trường `is_active` như v1. */
export function toRoleListItem(role: CoreRole): RoleListItemResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    is_active: role.isActive,
    createdAt: role.createdAt,
    users: (role.userRoles || []).map((ur) => toRoleUser(ur.user)),
  };
}

export function toRoleResponse(role: CoreRole): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export function toPermissionResponse(p: CorePermission): PermissionResponse {
  return {
    id: p.id,
    roleId: p.roleId,
    resource: p.resource,
    action: p.action,
    conditions: p.conditions,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
