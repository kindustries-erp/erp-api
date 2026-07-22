import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsValidToErpInvoices1784304516000 implements MigrationInterface {
  name = 'AddIsValidToErpInvoices1784304516000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "is_valid" boolean DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "validated_at" timestamptz`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "validated_by" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "validated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "validated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "is_valid"`,
    );
  }
}
