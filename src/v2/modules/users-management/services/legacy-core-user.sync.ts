import { IsNull } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { UsersManagement } from '../entities/users-management.entity';

/**
 * BẢN SAO TẠM sang `core_users` cho giai đoạn chạy song song v1/v2. Xóa file này khi cutover các FK sang
 * `users_management`.
 *
 * `users_management` là nguồn chính. `core_users` chỉ còn là bản sao một chiều, ghi trong CÙNG transaction với
 * mọi thay đổi tài khoản, vì `core_notifications` và `core_refresh_tokens` (v1) vẫn có khóa ngoại trỏ
 * `core_users` (`rbac_user_roles`, `table_preferences`, `notifications_inbox`, `auth_sessions` đã trỏ
 * `users_management`). Không còn đường ghi nào
 * khác vào `core_users` (auth v1 và trang admin v1 đều ủy quyền sang service v2).
 */
export async function syncToLegacyCoreUser(
  manager: EntityManager,
  user: UsersManagement,
): Promise<void> {
  await manager.getRepository(CoreUser).save({
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    status: user.status,
    employeeId: user.employeeId,
    lastLoginAt: user.lastLoginAt,
    createdBy: user.createdBy,
    passwordChangedAt: user.passwordChangedAt,
  });
}

/**
 * Thu hồi mọi phiên đăng nhập còn hiệu lực của tài khoản (đổi mật khẩu, đặt lại mật khẩu, vô hiệu hóa):
 * refresh token v1 (`core_refresh_tokens`) và session v2 (`auth_sessions`).
 */
export async function revokeAllUserSessions(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  await manager
    .getRepository(CoreRefreshToken)
    .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  await manager.query(
    `UPDATE "auth_sessions" SET "revoked_at" = now(), "updated_at" = now()
     WHERE "user_id" = $1 AND "revoked_at" IS NULL`,
    [userId],
  );
}
