import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryIdToErpBoms1787000000002 implements MigrationInterface {
  name = 'AddCategoryIdToErpBoms1787000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_boms"
      ADD COLUMN IF NOT EXISTS "category_id" uuid NULL;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_erp_boms_category'
        ) THEN
          ALTER TABLE "erp_boms"
          ADD CONSTRAINT "FK_erp_boms_category"
          FOREIGN KEY ("category_id")
          REFERENCES "erp_bom_categories"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_boms_category_id"
      ON "erp_boms" ("category_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_erp_boms_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_boms" DROP CONSTRAINT IF EXISTS "FK_erp_boms_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_boms" DROP COLUMN IF EXISTS "category_id"`,
    );
  }
}
