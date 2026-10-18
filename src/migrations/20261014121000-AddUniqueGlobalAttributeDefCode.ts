import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniqueGlobalAttributeDefCode20261014121000 implements MigrationInterface {
  name = 'AddUniqueGlobalAttributeDefCode20261014121000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Unique (category_id, code) không chặn trùng khi category_id NULL (def global) → thêm partial unique.
    const dup = await queryRunner.query(`
      SELECT "module_key_global", "code", COUNT(*)::int AS cnt
      FROM "erp_module_attribute_defs"
      WHERE "category_id" IS NULL AND "is_global" = true
      GROUP BY "module_key_global", "code"
      HAVING COUNT(*) > 1
    `);
    if (dup.length > 0) {
      throw new Error(
        `Không thể tạo unique index: có def global trùng code: ${JSON.stringify(dup)}. Xử lý dữ liệu trùng trước khi chạy lại.`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_erp_module_attribute_defs_global_code"
      ON "erp_module_attribute_defs"("module_key_global", "code")
      WHERE "category_id" IS NULL AND "is_global" = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_erp_module_attribute_defs_global_code";`,
    );
  }
}
