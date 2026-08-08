import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceCategoryToErpInvoices1786160840952 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "invoice_category" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" RENAME COLUMN "invoice_category" TO "invoice_subcategory"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" RENAME COLUMN "invoice_subcategory" TO "invoice_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "invoice_category"`,
    );
  }
}
