import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceErpOperatingExpensesRecurring1787800000000 implements MigrationInterface {
  name = 'EnhanceErpOperatingExpensesRecurring1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_operating_expenses"
      ADD COLUMN IF NOT EXISTS "period_year" smallint,
      ADD COLUMN IF NOT EXISTS "period_month" smallint,
      ADD COLUMN IF NOT EXISTS "category_key" varchar(100),
      ADD COLUMN IF NOT EXISTS "cost_group" varchar(50) DEFAULT 'OPEX',
      ADD COLUMN IF NOT EXISTS "recurrence_until_year" smallint,
      ADD COLUMN IF NOT EXISTS "recurrence_until_month" smallint,
      ADD COLUMN IF NOT EXISTS "recurrence_anchor_id" uuid;

      -- Backfill data cho các bản ghi cũ
      UPDATE "erp_operating_expenses"
      SET 
        "period_year" = COALESCE(EXTRACT(YEAR FROM document_date)::smallint, EXTRACT(YEAR FROM created_at)::smallint, 2026),
        "period_month" = COALESCE(EXTRACT(MONTH FROM document_date)::smallint, EXTRACT(MONTH FROM created_at)::smallint, 1),
        "category_key" = COALESCE(category_key, expense_category, 'KHAC'),
        "cost_group" = COALESCE(cost_group, 'OPEX')
      WHERE "period_year" IS NULL OR "period_month" IS NULL;

      -- Tạo Composite Indexes
      CREATE INDEX IF NOT EXISTS "idx_erp_opex_period" ON "erp_operating_expenses" ("period_year", "period_month");
      CREATE INDEX IF NOT EXISTS "idx_erp_opex_category_key" ON "erp_operating_expenses" ("category_key");
      CREATE INDEX IF NOT EXISTS "idx_erp_opex_cost_group" ON "erp_operating_expenses" ("cost_group");
      CREATE INDEX IF NOT EXISTS "idx_erp_opex_recurrence_anchor" ON "erp_operating_expenses" ("recurrence_anchor_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_erp_opex_recurrence_anchor";
      DROP INDEX IF EXISTS "idx_erp_opex_cost_group";
      DROP INDEX IF EXISTS "idx_erp_opex_category_key";
      DROP INDEX IF EXISTS "idx_erp_opex_period";

      ALTER TABLE "erp_operating_expenses"
      DROP COLUMN IF EXISTS "recurrence_anchor_id",
      DROP COLUMN IF EXISTS "recurrence_until_month",
      DROP COLUMN IF EXISTS "recurrence_until_year",
      DROP COLUMN IF EXISTS "cost_group",
      DROP COLUMN IF EXISTS "category_key",
      DROP COLUMN IF EXISTS "period_month",
      DROP COLUMN IF EXISTS "period_year";
    `);
  }
}
