import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceExternalIdToErpInvoices20260624120000 implements MigrationInterface {
  name = 'AddSourceExternalIdToErpInvoices20260624120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "source" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "external_id" character varying(255)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_invoices_invoice_no_serial_no_direction" ON "erp_invoices" ("invoice_no", "serial_no", "direction")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_invoices_invoice_no_serial_no_direction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "external_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN IF EXISTS "source"`,
    );
  }
}
