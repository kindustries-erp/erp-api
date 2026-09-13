import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceCategoryToInvoiceItems1785900000000 implements MigrationInterface {
  name = 'AddInvoiceCategoryToInvoiceItems1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "invoice_category" character varying(32) NOT NULL DEFAULT 'NORMAL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN "invoice_category"`,
    );
  }
}
