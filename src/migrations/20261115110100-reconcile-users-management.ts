import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Đối chiếu cuối `core_users` -> `users_management` trước khi `users_management` thành nguồn chính (auth v2).
 * Trước đây v2 kéo thay đổi của v1 ở mỗi lần đọc/ghi (`pullFromLegacyCoreUsers`, đã bỏ); migration này làm đúng
 * một lần việc đó. Idempotent: chạy lại không đổi gì khi hai bảng đã khớp.
 * - Thêm tài khoản v1 tạo sau lần backfill.
 * - Cập nhật dòng lệch; email hoặc nhân viên sẽ vi phạm unique/FK thì giữ giá trị cũ.
 * - Sau đó, nếu còn dòng lệch hoặc thiếu thì báo lỗi và liệt kê id (không im lặng bỏ sót).
 * down() không làm gì (không xóa dữ liệu, không đụng `core_users`).
 */
export class ReconcileUsersManagement20261115110100 implements MigrationInterface {
  name = 'ReconcileUsersManagement20261115110100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
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
        AND (
          um."password_hash" IS DISTINCT FROM cu."password_hash"
          OR um."status" IS DISTINCT FROM cu."status"
          OR um."email" IS DISTINCT FROM lower(trim(cu."email"))
          OR um."employee_id" IS DISTINCT FROM cu."employee_id"
          OR um."last_login_at" IS DISTINCT FROM cu."last_login_at"
          OR um."password_changed_at" IS DISTINCT FROM cu."password_changed_at"
          OR um."legacy_directus_user_id" IS DISTINCT FROM cu."legacy_directus_user_id"
        )
    `);

    const mismatched: { id: string }[] = await queryRunner.query(`
      SELECT cu."id" FROM "core_users" cu
      LEFT JOIN "users_management" um ON um."id" = cu."id"
      WHERE um."id" IS NULL
         OR um."password_hash" IS DISTINCT FROM cu."password_hash"
         OR um."status" IS DISTINCT FROM cu."status"
         OR um."last_login_at" IS DISTINCT FROM cu."last_login_at"
         OR um."password_changed_at" IS DISTINCT FROM cu."password_changed_at"
    `);
    if (mismatched.length > 0) {
      throw new Error(
        `Đối chiếu users_management còn lệch ${mismatched.length} tài khoản: ${mismatched
          .map((row) => row.id)
          .join(', ')}`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không hoàn tác dữ liệu: đối chiếu một chiều, không xóa gì.
  }
}
