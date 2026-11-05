import { ErpAction, ErpResource } from '../enums';
import type { CorePermission } from '../entities/core-permission.entity';

/**
 * Kiểm tra một cặp (resource, action) có khớp danh sách quyền của người dùng không.
 * Khớp khi resource trùng, hoặc quyền là SUPER_ADMIN / '*', và action trùng, hoặc là ALL / '*'.
 * Hàm thuần: không truy vấn DB.
 */
export function checkPermissionMatch(
  userPermissions: CorePermission[],
  resource: ErpResource | string,
  action: ErpAction | string,
): boolean {
  const matchResources: string[] = [
    String(resource),
    String(ErpResource.SUPER_ADMIN),
    '*',
  ];
  const matchActions: string[] = [String(action), String(ErpAction.ALL), '*'];
  return userPermissions.some(
    (p) =>
      matchResources.includes(String(p.resource)) &&
      matchActions.includes(String(p.action)),
  );
}
