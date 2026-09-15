import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentAttrCodeToModuleAttributeDefs1789300000000 implements MigrationInterface {
  name = 'AddParentAttrCodeToModuleAttributeDefs1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const tableName =
      tableExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    // 1. Add parent_attr_code column if not exists
    await queryRunner.query(`
      ALTER TABLE "${tableName}" 
      ADD COLUMN IF NOT EXISTS "parent_attr_code" VARCHAR(100) NULL;
    `);

    // 2. Set parent_attr_code = 'category' for subcategory attribute defs
    await queryRunner.query(`
      UPDATE "${tableName}"
      SET "parent_attr_code" = 'category'
      WHERE "code" = 'subcategory' AND ("parent_attr_code" IS NULL OR "parent_attr_code" = '');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs'
    `);
    const tableName =
      tableExists.length > 0
        ? 'erp_module_attribute_defs'
        : 'erp_bom_attribute_defs';

    await queryRunner.query(`
      ALTER TABLE "${tableName}" 
      DROP COLUMN IF EXISTS "parent_attr_code";
    `);
  }
}
