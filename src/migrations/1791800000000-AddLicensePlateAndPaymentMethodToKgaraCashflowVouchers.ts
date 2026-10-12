import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLicensePlateAndPaymentMethodToKgaraCashflowVouchers1791800000000 implements MigrationInterface {
  name = 'AddLicensePlateAndPaymentMethodToKgaraCashflowVouchers1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "license_plate" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "payment_method" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" ADD COLUMN IF NOT EXISTS "partner_name" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_license_plate" ON "kgara_cashflow_vouchers" ("license_plate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gara_cashflow_payment_method" ON "kgara_cashflow_vouchers" ("payment_method")`,
    );

    // Backfill license_plate and partner_name from linked kgara_cases
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers" v
      SET 
        license_plate = c.bien_so_xe,
        partner_name = COALESCE(v.partner_name, c.khach_hang_name)
      FROM "kgara_cases" c
      WHERE v.case_id = c.id AND (v.license_plate IS NULL OR v.partner_name IS NULL)
    `);

    // Backfill payment_method from kgara_case_settlements if available
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers" v
      SET payment_method = CASE 
        WHEN s.payment_method = 'BANK_TRANSFER' THEN 'Chuyển khoản'
        WHEN s.payment_method = 'CASH' THEN 'Tiền mặt'
        WHEN s.payment_method = 'POS' THEN 'Thẻ tín dụng'
        ELSE 'Khác'
      END
      FROM "kgara_case_settlements" s
      WHERE s.cashflow_voucher_id = v.id AND v.payment_method IS NULL
    `);

    // Fallback payment_method based on linked bank transaction or cash voucher
    await queryRunner.query(`
      UPDATE "kgara_cashflow_vouchers"
      SET payment_method = CASE
        WHEN erp_bank_transaction_id IS NOT NULL THEN 'Chuyển khoản'
        WHEN erp_cash_voucher_id IS NOT NULL THEN 'Tiền mặt'
        ELSE 'Tiền mặt'
      END
      WHERE payment_method IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gara_cashflow_payment_method"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_gara_cashflow_license_plate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "partner_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "payment_method"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cashflow_vouchers" DROP COLUMN IF EXISTS "license_plate"`,
    );
  }
}
