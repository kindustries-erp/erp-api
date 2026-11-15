import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `core_user_table_preferences` -> `table_preferences`: đổi tên bảng/PK/unique/FK,
 * thêm `is_deleted` và `extra_data` (CHECK object) theo base-core, FK user -> `users_management`.
 */
export class RenameUserTablePreferences20261115120200 implements MigrationInterface {
  name = 'RenameUserTablePreferences20261115120200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const orphans: Array<{ n: string }> = await queryRunner.query(
      `SELECT count(*)::text AS n FROM "core_user_table_preferences" t
       WHERE NOT EXISTS (SELECT 1 FROM "users_management" u WHERE u."id" = t."user_id")`,
    );
    if (Number(orphans[0]?.n ?? 0) > 0) {
      throw new Error(
        `core_user_table_preferences còn ${orphans[0].n} dòng user_id không có trong users_management`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "core_user_table_preferences" RENAME TO "table_preferences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" RENAME CONSTRAINT "PK_core_user_table_preferences_id" TO "PK_table_preferences_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_core_user_table_preferences_user_table" RENAME TO "UQ_table_preferences_user_table"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" DROP CONSTRAINT "FK_core_user_table_preferences_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" ADD CONSTRAINT "FK_table_preferences_user_id"
       FOREIGN KEY ("user_id") REFERENCES "users_management"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences"
         ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false,
         ADD COLUMN IF NOT EXISTS "extra_data" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" ADD CONSTRAINT "CHK_table_preferences_extra_data_object"
       CHECK (jsonb_typeof("extra_data") = 'object')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "table_preferences" DROP CONSTRAINT IF EXISTS "CHK_table_preferences_extra_data_object"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" DROP COLUMN IF EXISTS "extra_data", DROP COLUMN IF EXISTS "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" DROP CONSTRAINT "FK_table_preferences_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" ADD CONSTRAINT "FK_core_user_table_preferences_user_id"
       FOREIGN KEY ("user_id") REFERENCES "core_users"("id")
       ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER INDEX "UQ_table_preferences_user_table" RENAME TO "UQ_core_user_table_preferences_user_table"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" RENAME CONSTRAINT "PK_table_preferences_id" TO "PK_core_user_table_preferences_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "table_preferences" RENAME TO "core_user_table_preferences"`,
    );
  }
}
