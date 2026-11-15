import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill `users_management` từ `core_users` (một chiều, giữ nguyên `id`).
 * - `core_users.created_at/updated_at` là timestamp không múi giờ, được ghi bằng `now()` của DB (múi giờ DB
 *   là UTC). Đọc cố định theo UTC, không phụ thuộc `TimeZone` của session chạy migration, rồi chuyển sang timestamptz.
 * - `employee_id` chỉ giữ khi nhân viên còn tồn tại trong `erp_employees` (tránh vi phạm FK).
 * - `ON CONFLICT DO NOTHING`: chạy lại an toàn, bỏ qua dòng đã có (trùng id hoặc email).
 * - Sau khi chèn, nếu còn tài khoản `core_users` chưa có dòng tương ứng (trùng email sau chuẩn hóa hoặc trùng
 *   nhân viên) thì migration báo lỗi và liệt kê id, không im lặng bỏ sót.
 * down() không xóa dữ liệu: `users_management` do migration tạo bảng quản lý; `core_users` không bị chạm.
 */
export class BackfillUsersManagement20261115100100 implements MigrationInterface {
  name = 'BackfillUsersManagement20261115100100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "users_management" (
        "id", "email", "password_hash", "status", "employee_id",
        "legacy_directus_user_id", "last_login_at", "created_by",
        "password_changed_at", "created_at", "updated_at", "is_deleted", "extra_data"
      )
      SELECT
        cu."id",
        lower(trim(cu."email")),
        cu."password_hash",
        cu."status",
        CASE WHEN emp."id" IS NULL THEN NULL ELSE cu."employee_id" END,
        cu."legacy_directus_user_id",
        cu."last_login_at",
        cu."created_by",
        cu."password_changed_at",
        cu."created_at" AT TIME ZONE 'UTC',
        cu."updated_at" AT TIME ZONE 'UTC',
        false,
        '{}'::jsonb
      FROM "core_users" cu
      LEFT JOIN "erp_employees" emp ON emp."id" = cu."employee_id"
      ON CONFLICT DO NOTHING
    `);

    const missing: { id: string }[] = await queryRunner.query(`
      SELECT cu."id" FROM "core_users" cu
      WHERE NOT EXISTS (SELECT 1 FROM "users_management" um WHERE um."id" = cu."id")
    `);
    if (missing.length > 0) {
      throw new Error(
        `Backfill users_management bỏ sót ${missing.length} tài khoản (trùng email sau chuẩn hóa hoặc trùng nhân viên): ${missing
          .map((row) => row.id)
          .join(', ')}`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Không xóa dữ liệu khi rollback: bảng đích chỉ bị xóa bởi migration tạo bảng.
  }
}
