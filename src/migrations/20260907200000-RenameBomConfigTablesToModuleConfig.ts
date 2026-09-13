import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameBomConfigTablesToModuleConfig20260907200000 implements MigrationInterface {
  name = 'RenameBomConfigTablesToModuleConfig20260907200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename table erp_bom_categories -> erp_module_categories
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_bom_categories') THEN
          ALTER TABLE "erp_bom_categories" RENAME TO "erp_module_categories";
        END IF;
      END $$;
    `);

    // 2. Rename table erp_bom_attribute_defs -> erp_module_attribute_defs
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_bom_attribute_defs') THEN
          ALTER TABLE "erp_bom_attribute_defs" RENAME TO "erp_module_attribute_defs";
        END IF;
      END $$;
    `);

    // 3. Drop legacy erp_bom_attribute_values table if it exists
    await queryRunner.query(`
      DROP TABLE IF EXISTS "erp_bom_attribute_values" CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Revert erp_module_attribute_defs -> erp_bom_attribute_defs
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_module_attribute_defs') THEN
          ALTER TABLE "erp_module_attribute_defs" RENAME TO "erp_bom_attribute_defs";
        END IF;
      END $$;
    `);

    // 2. Revert erp_module_categories -> erp_bom_categories
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_module_categories') THEN
          ALTER TABLE "erp_module_categories" RENAME TO "erp_bom_categories";
        END IF;
      END $$;
    `);
  }
}
