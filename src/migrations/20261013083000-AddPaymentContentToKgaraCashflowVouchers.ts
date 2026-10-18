import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentContentToKgaraCashflowVouchers20261013083000 implements MigrationInterface {
  name = 'AddPaymentContentToKgaraCashflowVouchers20261013083000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "payment_content" character varying(100)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_payment_content" ON "kgara_cashflow_vouchers" ("payment_content")`,
    );

    // Backfill historical data: chuyển các bản ghi có payment_method là 'Ứng trước' hoặc 'Cấn trừ' sang payment_content
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET 
        payment_content = payment_method,
        payment_method = CASE
          WHEN erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản'
          WHEN erp_cash_voucher_id IS NOT NULL THEN 'Tiền mặt'
          ELSE 'Khác'
        END
      WHERE payment_method IN ('Ứng trước', 'Cấn trừ')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gara_cashflow_payment_content"`,
    );

    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "payment_content"`,
    );
  }
}
