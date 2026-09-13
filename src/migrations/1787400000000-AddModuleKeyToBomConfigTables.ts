import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModuleKeyToBomConfigTables1787400000000 implements MigrationInterface {
  name = 'AddModuleKeyToBomConfigTables1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add module_key column with default 'BOM'
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      ADD COLUMN IF NOT EXISTS "module_key" character varying(50) NOT NULL DEFAULT 'BOM';
    `);

    // 2. Drop old global unique constraint on code if exists
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      DROP CONSTRAINT IF EXISTS "UQ_erp_bom_categories_code";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_erp_bom_categories_code";
    `);

    // 3. Add composite unique constraint on (module_key, code)
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      ADD CONSTRAINT "UQ_erp_bom_categories_module_code" UNIQUE ("module_key", "code");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      DROP CONSTRAINT IF EXISTS "UQ_erp_bom_categories_module_code";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      ADD CONSTRAINT "UQ_erp_bom_categories_code" UNIQUE ("code");
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" 
      DROP COLUMN IF EXISTS "module_key";
    `);
  }
}
