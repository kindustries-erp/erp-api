import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceTypeToErpInvoices20260624163000 implements MigrationInterface {
  name = 'AddInvoiceTypeToErpInvoices20260624163000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "invoice_type" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "invoice_type"`,
    );
  }
}
