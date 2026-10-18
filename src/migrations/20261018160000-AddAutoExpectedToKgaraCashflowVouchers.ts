import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoExpectedToKgaraCashflowVouchers20261018160000 implements MigrationInterface {
  name = 'AddAutoExpectedToKgaraCashflowVouchers20261018160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "is_auto_expected" boolean DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_auto_expected" ON "kgara_cashflow_vouchers" ("case_id", "voucher_type", "payment_status", "is_auto_expected")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gara_cashflow_auto_expected"`,
    );

    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "is_auto_expected"`,
    );
  }
}
