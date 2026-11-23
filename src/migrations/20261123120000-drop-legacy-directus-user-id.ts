import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bỏ cột `legacy_directus_user_id` ở `users_management` và `core_users` (cùng index
 * `idx_core_users_legacy_directus_user_id`). Cột không còn nguồn ghi; đã kiểm 0 dòng
 * có giá trị trên staging/production của greenway và klotus. `down()` chỉ tạo lại
 * cấu trúc, không khôi phục dữ liệu.
 */
export class DropLegacyDirectusUserId20261123120000 implements MigrationInterface {
  name = 'DropLegacyDirectusUserId20261123120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_core_users_legacy_directus_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP COLUMN IF EXISTS "legacy_directus_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_management" DROP COLUMN IF EXISTS "legacy_directus_user_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users_management" ADD COLUMN IF NOT EXISTS "legacy_directus_user_id" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD COLUMN IF NOT EXISTS "legacy_directus_user_id" uuid NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_core_users_legacy_directus_user_id" ON "core_users" ("legacy_directus_user_id")`,
    );
  }
}
