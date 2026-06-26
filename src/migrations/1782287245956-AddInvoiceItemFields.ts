import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceItemFields1782287245956 implements MigrationInterface {
  name = 'AddInvoiceItemFields1782287245956';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_erp_invoices_invoice_no_serial_no_direction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "unit" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "quantity" numeric(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD "unit_price" numeric(18,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN "unit_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN "quantity"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP COLUMN "unit"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_erp_invoices_invoice_no_serial_no_direction" ON "erp_invoices" ("direction", "invoice_no", "serial_no") `,
    );
  }
}
