import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPnlCommissionColumnsToVouchers20261018151000 implements MigrationInterface {
  name = 'AddPnlCommissionColumnsToVouchers20261018151000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_cashflow_vouchers"
      ADD COLUMN IF NOT EXISTS "is_auto_commission" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "pnl_period_year" smallint NULL,
      ADD COLUMN IF NOT EXISTS "pnl_period_month" smallint NULL,
      ADD COLUMN IF NOT EXISTS "pnl_commission_type" varchar(20) NULL,
      ADD COLUMN IF NOT EXISTS "pnl_commission_anchor_id" uuid NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_pnl_period"
      ON "kgara_cashflow_vouchers" ("pnl_period_year", "pnl_period_month")
      WHERE "is_auto_commission" = true;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_pnl_anchor"
      ON "kgara_cashflow_vouchers" ("pnl_commission_anchor_id")
      WHERE "pnl_commission_anchor_id" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_gara_cashflow_pnl_anchor";
      DROP INDEX IF EXISTS "IDX_gara_cashflow_pnl_period";
    `);

    await queryRunner.query(`
      ALTER TABLE "kgara_cashflow_vouchers"
      DROP COLUMN IF EXISTS "pnl_commission_anchor_id",
      DROP COLUMN IF EXISTS "pnl_commission_type",
      DROP COLUMN IF EXISTS "pnl_period_month",
      DROP COLUMN IF EXISTS "pnl_period_year",
      DROP COLUMN IF EXISTS "is_auto_commission";
    `);
  }
}
