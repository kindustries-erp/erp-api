import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelatedInvoiceFields1786740000000 implements MigrationInterface {
  name = 'AddRelatedInvoiceFields1786740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "related_invoice_no" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "related_serial_no" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "related_invoice_no"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "related_serial_no"`,
    );
  }
}
