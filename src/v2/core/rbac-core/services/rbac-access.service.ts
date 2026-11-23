import { checkPermissionMatch } from '../helpers/permission-match.helper';
import type {
  RbacPermissionGrant,
  RbacPermissionRequirement,
} from '../contracts/rbac-access.contract';
import type { ErpAction, ErpResource } from '../enums';

/**
 * Engine kiểm quyền dùng chung toàn hệ thống (lõi họ rbac), chỉ chứa logic thuần.
 * Dữ liệu (role, quyền, người dùng) do module cụ thể cung cấp qua 3 hook trừu tượng;
 * class này cũng là DI token: guard, auth và module khác inject `RbacAccessService`.
 */
export abstract class RbacAccessService {
  /** Quyền (đã khử trùng) của các role đang hoạt động của người dùng. */
  abstract getUserPermissions(userId: string): Promise<RbacPermissionGrant[]>;

  /** Tên các role đang hoạt động của người dùng, dùng để ghi nhật ký duyệt. */
  abstract getUserRoleNames(userId: string): Promise<string[]>;

  /**
   * Danh sách user ID có đủ mọi action trên resource (role đang hoạt động).
   * Khớp quyền như checkPermissionMatch. Không lọc trạng thái user (việc của lớp gọi).
   */
  abstract findUserIdsWithPermissions(
    resource: string,
    actions: string[],
  ): Promise<string[]>;

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
    requiredPermissions: RbacPermissionRequirement[],
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const permissions = await this.getUserPermissions(userId);
    return requiredPermissions.some((req) =>
      checkPermissionMatch(permissions, req.resource, req.action),
    );
  }

  async hasAllPermissions(
    userId: string,
    requiredPermissions: RbacPermissionRequirement[],
  ): Promise<boolean> {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    const permissions = await this.getUserPermissions(userId);
    return requiredPermissions.every((req) =>
      checkPermissionMatch(permissions, req.resource, req.action),
    );
  }
}
