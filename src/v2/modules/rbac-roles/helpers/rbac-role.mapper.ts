import type { RbacRole } from '@/v2/modules/rbac-roles/entities/rbac-role.entity';
import type { RbacPermission } from '@/v2/modules/rbac-roles/entities/rbac-permission.entity';
import type { UsersManagement } from '@/v2/modules/users-management/entities/users-management.entity';
import type {
  PermissionResponse,
  RoleListItemResponse,
  RoleResponse,
  RoleUserResponse,
} from '../dto/rbac-response.dto';

/** Chỉ lộ id và email của người dùng; không trả password_hash hay các cột khác. */
export function toRoleUser(
  user: Pick<UsersManagement, 'id' | 'email'> | null | undefined,
): RoleUserResponse {
  return { id: user?.id as string, email: user?.email as string };
}

/** Dòng danh sách role: giữ tên trường `is_active` như v1. */
export function toRoleListItem(role: RbacRole): RoleListItemResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    is_active: role.isActive,
    createdAt: role.createdAt,
    users: (role.userRoles || []).map((ur) => toRoleUser(ur.user)),
  };
}

export function toRoleResponse(role: RbacRole): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

export function toPermissionResponse(p: RbacPermission): PermissionResponse {
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
