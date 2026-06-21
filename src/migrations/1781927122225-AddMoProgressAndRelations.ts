import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMoProgressAndRelations1781927122225 implements MigrationInterface {
  name = 'AddMoProgressAndRelations1781927122225';

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
      `ALTER TABLE "erp_goods_receipts" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" ADD "production_order_material_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "qty_produced" numeric(18,3) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "planned_start_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "planned_end_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" ADD "qty_issued" numeric(18,3) NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" DROP COLUMN "qty_issued"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "planned_end_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "planned_start_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "qty_produced"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" DROP COLUMN "production_order_material_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "production_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "production_order_id"`,
    );
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
