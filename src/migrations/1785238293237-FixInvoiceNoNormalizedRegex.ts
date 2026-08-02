import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInvoiceNoNormalizedRegex1785238293237 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_erp_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN "invoice_no_normalized" VARCHAR(100) GENERATED ALWAYS AS (REGEXP_REPLACE(invoice_no, '(^|[^0-9])0+([0-9]+)([^0-9]*)$', '\\1\\2\\3')) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_erp_invoice_no_normalized" ON "erp_invoices" ("invoice_no_normalized", "seller_tax_code", "direction")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_erp_invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "invoice_no_normalized"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN "invoice_no_normalized" VARCHAR(100) GENERATED ALWAYS AS (REGEXP_REPLACE(invoice_no, '([^0-9]*)0+([0-9]+)', '\\1\\2')) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_erp_invoice_no_normalized" ON "erp_invoices" ("invoice_no_normalized", "seller_tax_code", "direction")`,
    );
  }
}
