import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentStatusToKgaraCashflowVouchers20261016180000 implements MigrationInterface {
  name = 'AddPaymentStatusToKgaraCashflowVouchers20261016180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "payment_status" character varying(30)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_payment_status" ON "kgara_cashflow_vouchers" ("payment_status")`,
    );

    // Backfill historical data: các phiếu chi lịch sử được gán trạng thái 'PAID' (Đã chi)
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET "payment_status" = 'PAID'
      WHERE "voucher_type" = 'PAYMENT' AND "payment_status" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gara_cashflow_payment_status"`,
    );

    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "payment_status"`,
    );
  }
}
