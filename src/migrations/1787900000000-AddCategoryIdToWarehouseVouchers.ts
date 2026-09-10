import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryIdToWarehouseVouchers1787900000000 implements MigrationInterface {
  name = 'AddCategoryIdToWarehouseVouchers1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add category_id to erp_goods_receipts
    await queryRunner.query(`
      ALTER TABLE "erp_goods_receipts" ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_goods_receipts_category') THEN
          ALTER TABLE "erp_goods_receipts" ADD CONSTRAINT "FK_erp_goods_receipts_category" 
            FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_goods_receipts_category_id" ON "erp_goods_receipts" ("category_id");
    `);

    // 2. Add category_id to erp_goods_issues
    await queryRunner.query(`
      ALTER TABLE "erp_goods_issues" ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_goods_issues_category') THEN
          ALTER TABLE "erp_goods_issues" ADD CONSTRAINT "FK_erp_goods_issues_category" 
            FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_goods_issues_category_id" ON "erp_goods_issues" ("category_id");
    `);

    // 3. Add category_id to erp_inventory_adjustments
    await queryRunner.query(`
      ALTER TABLE "erp_inventory_adjustments" ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_inventory_adjustments_category') THEN
          ALTER TABLE "erp_inventory_adjustments" ADD CONSTRAINT "FK_erp_inventory_adjustments_category" 
            FOREIGN KEY ("category_id") REFERENCES "erp_bom_categories"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_inventory_adjustments_category_id" ON "erp_inventory_adjustments" ("category_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP CONSTRAINT IF EXISTS "FK_erp_inventory_adjustments_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_adjustments" DROP COLUMN IF EXISTS "category_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP CONSTRAINT IF EXISTS "FK_erp_goods_issues_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN IF EXISTS "category_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP CONSTRAINT IF EXISTS "FK_erp_goods_receipts_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN IF EXISTS "category_id"`,
    );
  }
}
