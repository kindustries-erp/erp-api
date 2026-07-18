import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaxPortalStatusesToErpInvoices20260717193500 implements MigrationInterface {
  name = 'AddTaxPortalStatusesToErpInvoices20260717193500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "tax_invoice_status" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "tax_process_status" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "tax_invoice_type" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "tax_invoice_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "tax_process_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "tax_invoice_type"`,
    );
  }
}
