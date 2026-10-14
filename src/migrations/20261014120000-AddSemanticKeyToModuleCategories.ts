import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSemanticKeyToModuleCategories20261014120000 implements MigrationInterface {
  name = 'AddSemanticKeyToModuleCategories20261014120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_module_categories"
      ADD COLUMN IF NOT EXISTS "semantic_key" VARCHAR(50) NULL;
    `);

    // Backfill GARAGE_CASE: logic nghiệp vụ dựa vào semantic_key, không dựa vào code admin sửa được.
    await queryRunner.query(`
      UPDATE "erp_module_categories"
      SET "semantic_key" = CASE
        WHEN "code" IN ('OJ', 'OJ_NGOAI') THEN 'OJ'
        WHEN "code" = 'KY_GUI_NOI_BO' THEN 'INTERNAL'
        WHEN "code" = 'SUA_CHUA_CHUNG' THEN 'GENERAL'
        WHEN "code" = 'KHAC' THEN 'OTHER'
        ELSE "semantic_key"
      END
      WHERE "module_key" = 'GARAGE_CASE' AND "semantic_key" IS NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_erp_module_categories_semantic_key"
      ON "erp_module_categories"("module_key", "semantic_key")
      WHERE "semantic_key" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_erp_module_categories_semantic_key";`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_module_categories" DROP COLUMN IF EXISTS "semantic_key";`,
    );
  }
}
