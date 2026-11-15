import { IsNull } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { CoreRefreshToken } from '@/auth/entities/core-refresh-token.entity';
import { CoreUser } from '@/users/entities/core-user.entity';
import { UsersManagement } from '../entities/users-management.entity';

/**
 * ADAPTER TẠM cho giai đoạn chạy song song v1/v2. Xóa file này khi cutover các FK sang `users_management`.
 *
 * Auth, RBAC, refresh token, preferences, notifications và approval vẫn trỏ `core_users`, và v1 vẫn ghi
 * thẳng vào đó (đăng nhập ghi `last_login_at`, đổi mật khẩu ghi `password_hash`, trang admin v1).
 * Quy ước:
 *  - v2 luôn ghi sang `core_users` (cùng `id`) trong CÙNG transaction, nên sau mỗi thao tác v2 hai bảng bằng nhau.
 *  - Vì vậy nếu hai bảng lệch nhau khi bắt đầu một thao tác v2, nghĩa là v1 vừa đổi `core_users`:
 *    `core_users` là nguồn đúng và được kéo về `users_management` (`pullFromLegacyCoreUsers`) trước khi v2 đọc hoặc ghi.
 *    Nhờ đó v2 không bao giờ ghi đè đổi mật khẩu hay mốc đăng nhập của v1 bằng giá trị cũ.
 */
export async function pullFromLegacyCoreUsers(
  manager: EntityManager,
  userId: string | null = null,
): Promise<void> {
  if (userId) {
    // Khóa hàng core_users: v1 (đăng nhập, đổi mật khẩu) phải chờ tới khi thao tác v2 commit
    await manager.query(
      'SELECT 1 FROM "core_users" WHERE "id" = $1 FOR UPDATE',
      [userId],
    );
  }

  // 1. Tài khoản v1 tạo sau lần backfill
  await manager.query(
    `
    INSERT INTO "users_management" (
      "id", "email", "password_hash", "status", "employee_id",
      "legacy_directus_user_id", "last_login_at", "created_by",
      "password_changed_at", "created_at", "updated_at", "is_deleted", "extra_data"
    )
    SELECT
      cu."id", lower(trim(cu."email")), cu."password_hash", cu."status",
      CASE WHEN emp."id" IS NULL THEN NULL ELSE cu."employee_id" END,
      cu."legacy_directus_user_id", cu."last_login_at", cu."created_by",
      cu."password_changed_at",
      cu."created_at" AT TIME ZONE 'UTC', cu."updated_at" AT TIME ZONE 'UTC',
      false, '{}'::jsonb
    FROM "core_users" cu
    LEFT JOIN "erp_employees" emp ON emp."id" = cu."employee_id"
    WHERE NOT EXISTS (SELECT 1 FROM "users_management" um WHERE um."id" = cu."id")
      AND ($1::uuid IS NULL OR cu."id" = $1::uuid)
    ON CONFLICT DO NOTHING
    `,
    [userId],
  );

  // 2. Tài khoản đã có nhưng v1 vừa đổi. Email hoặc nhân viên sẽ gây vi phạm unique/FK thì giữ giá trị cũ.
  await manager.query(
    `
    UPDATE "users_management" um SET
      "email" = CASE WHEN NOT EXISTS (
          SELECT 1 FROM "users_management" o
          WHERE o."email" = lower(trim(cu."email")) AND o."id" <> um."id"
        ) THEN lower(trim(cu."email")) ELSE um."email" END,
      "password_hash" = cu."password_hash",
      "status" = cu."status",
      "employee_id" = CASE
        WHEN cu."employee_id" IS NULL THEN NULL
        WHEN EXISTS (SELECT 1 FROM "erp_employees" e WHERE e."id" = cu."employee_id")
          AND NOT EXISTS (
            SELECT 1 FROM "users_management" o
            WHERE o."employee_id" = cu."employee_id" AND o."id" <> um."id"
          ) THEN cu."employee_id"
        ELSE um."employee_id" END,
      "legacy_directus_user_id" = cu."legacy_directus_user_id",
      "last_login_at" = cu."last_login_at",
      "password_changed_at" = cu."password_changed_at",
      "updated_at" = now()
    FROM "core_users" cu
    WHERE cu."id" = um."id"
      AND ($1::uuid IS NULL OR cu."id" = $1::uuid)
      AND (
        um."password_hash" IS DISTINCT FROM cu."password_hash"
        OR um."status" IS DISTINCT FROM cu."status"
        OR um."email" IS DISTINCT FROM lower(trim(cu."email"))
        OR um."employee_id" IS DISTINCT FROM cu."employee_id"
        OR um."last_login_at" IS DISTINCT FROM cu."last_login_at"
        OR um."password_changed_at" IS DISTINCT FROM cu."password_changed_at"
        OR um."legacy_directus_user_id" IS DISTINCT FROM cu."legacy_directus_user_id"
      )
    `,
    [userId],
  );
}

/** Ghi trạng thái v2 sang `core_users`. Chỉ gọi sau `pullFromLegacyCoreUsers` của cùng tài khoản trong cùng transaction. */
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
    legacyDirectusUserId: user.legacyDirectusUserId,
    lastLoginAt: user.lastLoginAt,
    createdBy: user.createdBy,
    passwordChangedAt: user.passwordChangedAt,
  });
}

/** Email đã có ở `core_users` (v1 tạo, hoặc bản ghi chưa được kéo về). So khớp không phân biệt hoa thường. */
export async function legacyEmailExists(
  manager: EntityManager,
  email: string,
): Promise<boolean> {
  const rows: unknown[] = await manager.query(
    'SELECT 1 FROM "core_users" WHERE lower(trim("email")) = $1 LIMIT 1',
    [email],
  );
  return rows.length > 0;
}

/** Thu hồi mọi refresh token còn hiệu lực (đổi mật khẩu, vô hiệu hóa tài khoản). */
export async function revokeLegacyRefreshTokens(
  manager: EntityManager,
  userId: string,
): Promise<void> {
  await manager
    .getRepository(CoreRefreshToken)
    .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
}
