import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalAttributesToBomAttributeDefs1787400000002 implements MigrationInterface {
  name = 'AddGlobalAttributesToBomAttributeDefs1787400000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Allow category_id to be NULL for global attributes
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ALTER COLUMN "category_id" DROP NOT NULL;
    `);

    // 2. Add is_global column (default false)
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ADD COLUMN IF NOT EXISTS "is_global" boolean NOT NULL DEFAULT false;
    `);

    // 3. Add module_key_global column for global attributes
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ADD COLUMN IF NOT EXISTS "module_key_global" character varying(50) NULL;
    `);

    // 4. Create unique partial index on (module_key_global, code) for global attributes
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_erp_bom_attr_defs_global_code" 
      ON "erp_bom_attribute_defs" ("module_key_global", "code") 
      WHERE "is_global" = true AND "is_deleted" = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_erp_bom_attr_defs_global_code";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      DROP COLUMN IF EXISTS "module_key_global";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      DROP COLUMN IF EXISTS "is_global";
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" 
      ALTER COLUMN "category_id" SET NOT NULL;
    `);
  }
}
