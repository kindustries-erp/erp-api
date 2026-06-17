import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceItems1781713518086 implements MigrationInterface {
  name = 'AddInvoiceItems1781713518086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT "fk_erp_invoices_po"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP CONSTRAINT "fk_erp_invoices_so"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_erp_invoices_direction"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_invoices_invoice_date"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_erp_invoices_po_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_erp_invoices_so_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_erp_invoices_xml_import"`,
    );
    await queryRunner.query(
      `CREATE TABLE "erp_invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoice_id" uuid NOT NULL, "description" text, "pre_vat_amount" numeric(18,2) NOT NULL DEFAULT '0', "vat_rate" numeric(9,4), "vat_amount" numeric(18,2) NOT NULL DEFAULT '0', "discount_amount" numeric(18,2) NOT NULL DEFAULT '0', "total_amount" numeric(18,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e9297d82abce492be2c26869817" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_63bcd1678582315715ebdacec4" ON "erp_invoices" ("direction") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" ADD CONSTRAINT "FK_15804751aeace639b7289fd8f22" FOREIGN KEY ("invoice_id") REFERENCES "erp_invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_invoice_items" DROP CONSTRAINT "FK_15804751aeace639b7289fd8f22"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_63bcd1678582315715ebdacec4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`DROP TABLE "erp_invoice_items"`);
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_xml_import" ON "erp_invoices" ("xml_import_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_so_id" ON "erp_invoices" ("sales_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_po_id" ON "erp_invoices" ("purchase_order_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_invoice_date" ON "erp_invoices" ("invoice_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_invoices_direction" ON "erp_invoices" ("direction") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_so" FOREIGN KEY ("sales_order_id") REFERENCES "erp_sales_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_invoices" ADD CONSTRAINT "fk_erp_invoices_po" FOREIGN KEY ("purchase_order_id") REFERENCES "erp_purchase_orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
