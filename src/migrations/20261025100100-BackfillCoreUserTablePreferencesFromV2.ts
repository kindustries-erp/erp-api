import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chuyển cấu hình V2 đang nằm trong `core_user_preferences.table_configs`
 * (key `v2:<tableId>`) sang bảng `core_user_table_preferences`.
 * Cột `table_configs` được giữ nguyên cho V1; migration chạy lại an toàn nhờ ON CONFLICT.
 */
export class BackfillCoreUserTablePreferencesFromV2_20261025100100 implements MigrationInterface {
  name = 'BackfillCoreUserTablePreferencesFromV2_20261025100100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "core_user_table_preferences" ("user_id", "table_id", "columns", "views")
      SELECT
        p."user_id",
        substring(e."key" FROM 4),
        CASE WHEN jsonb_typeof(e."value"->'columns') = 'object'
          THEN e."value"->'columns' ELSE '{}'::jsonb END,
        CASE WHEN jsonb_typeof(e."value"->'views') = 'object'
          THEN e."value"->'views' ELSE '{}'::jsonb END
      FROM "core_user_preferences" p
      CROSS JOIN LATERAL jsonb_each(p."table_configs") e
      WHERE e."key" LIKE 'v2:%'
        AND jsonb_typeof(e."value") = 'object'
      ON CONFLICT ("user_id", "table_id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Không xóa dữ liệu: bảng mới có thể đã được user ghi thêm sau khi backfill.
    // Dữ liệu gốc trong table_configs vẫn còn, nên rollback không mất thông tin.
  }
}
