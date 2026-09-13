import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceCategoryToErpInvoices1786160840952 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD COLUMN IF NOT EXISTS "invoice_category" varchar(255)`,
    );
    try {
      // await queryRunner.query(
      //   `ALTER TABLE "erp_invoice_items" RENAME COLUMN "invoice_category" TO "invoice_subcategory"`,
      // );
    } catch (e) {
      console.log('Column already renamed or exists');
    }
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
