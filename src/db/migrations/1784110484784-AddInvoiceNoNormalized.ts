import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceNoNormalized1784110484784 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice" ADD COLUMN "invoice_no_normalized" VARCHAR(100) GENERATED ALWAYS AS (REGEXP_REPLACE(invoice_no, '([^0-9]*)0+([0-9]+)', '\\1\\2')) STORED`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoice_no_normalized" ON "erp_invoice" ("invoice_no_normalized", "seller_tax_code", "direction")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_erp_invoice_no_normalized"`);
    await queryRunner.query(
      `ALTER TABLE "erp_invoice" DROP COLUMN "invoice_no_normalized"`,
    );
  }
}
