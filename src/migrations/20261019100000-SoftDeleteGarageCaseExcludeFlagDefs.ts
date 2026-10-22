import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2 cờ exclude_from_reports / exclude_from_debt là field dựng sẵn của GARAGE_CASE, nguồn duy nhất là cột kgara_cases.
 * Soft-delete 2 def hệ thống cũ để không còn hiện ở trang Trường tùy chỉnh (dữ liệu EAV đã được dọn ở migration 20261014130000).
 */
export class SoftDeleteGarageCaseExcludeFlagDefs20261019100000 implements MigrationInterface {
  name = 'SoftDeleteGarageCaseExcludeFlagDefs20261019100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "is_deleted" = true, "is_active" = false, "updated_at" = now()
      WHERE "module_key_global" = 'GARAGE_CASE'
        AND "is_global" = true
        AND "code" IN ('exclude_from_reports', 'exclude_from_debt');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "erp_module_attribute_defs"
      SET "is_deleted" = false, "is_active" = true, "updated_at" = now()
      WHERE "module_key_global" = 'GARAGE_CASE'
        AND "is_global" = true
        AND "code" IN ('exclude_from_reports', 'exclude_from_debt');
    `);
  }
}
