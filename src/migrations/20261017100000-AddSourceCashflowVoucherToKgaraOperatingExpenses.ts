import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceCashflowVoucherToKgaraOperatingExpenses20261017100000 implements MigrationInterface {
  name = 'AddSourceCashflowVoucherToKgaraOperatingExpenses20261017100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_operating_expenses" ADD COLUMN IF NOT EXISTS "source_cashflow_voucher_id" uuid`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_kgara_opex_source_voucher" ON "kgara_operating_expenses" ("source_cashflow_voucher_id")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_kgara_opex_source_cashflow_voucher'
        ) THEN
          ALTER TABLE "kgara_operating_expenses"
            ADD CONSTRAINT "FK_kgara_opex_source_cashflow_voucher"
            FOREIGN KEY ("source_cashflow_voucher_id")
            REFERENCES "kgara_cashflow_vouchers"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_operating_expenses" DROP CONSTRAINT IF EXISTS "FK_kgara_opex_source_cashflow_voucher"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_kgara_opex_source_voucher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_operating_expenses" DROP COLUMN IF EXISTS "source_cashflow_voucher_id"`,
    );
  }
}
