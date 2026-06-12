import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNoteToInventoryItems1781235465467 implements MigrationInterface {
  name = 'AddNoteToInventoryItems1781235465467';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_core_users_employee_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_core_users_legacy_directus_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "note" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP CONSTRAINT "core_users_email_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP CONSTRAINT "erp_employees_employee_code_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" DROP CONSTRAINT "erp_business_partners_code_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP CONSTRAINT "erp_inventory_items_sku_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_balances" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_balances" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_boms" DROP CONSTRAINT "erp_boms_bom_code_key"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_boms" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_boms" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP CONSTRAINT "erp_purchase_requests_request_no_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP CONSTRAINT "erp_purchase_orders_po_no_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ALTER COLUMN "payment_status" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP CONSTRAINT "erp_goods_receipts_receipt_no_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ALTER COLUMN "qty_received" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP CONSTRAINT "erp_goods_issues_issue_no_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP CONSTRAINT "erp_sales_orders_so_no_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f30f10221183a52e8d76e7780a" ON "core_users" ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4dd7cf4c0480e2b12751a4fa2a" ON "erp_employees" ("employee_code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_41e4debe2f4b2b1b011a6c6a9f" ON "erp_business_partners" ("code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_be3501abc6b681be52900ee48e" ON "erp_inventory_items" ("sku") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4b5651bad5828ff8baf279728c" ON "erp_boms" ("bom_code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3f5cf5251bc14965d30b031ba7" ON "erp_purchase_requests" ("request_no") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_d4f109b9aeebbe94c219bf1904" ON "erp_purchase_orders" ("po_no") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e782065896f7a7f531ac1eddc6" ON "erp_goods_receipts" ("receipt_no") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e7d5f00be786d23126d7d61786" ON "erp_goods_issues" ("issue_no") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_73cbc322e818c4eb3472d5d002" ON "erp_sales_orders" ("so_no") `,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD CONSTRAINT "FK_de47da08f6e9e8b18601692fa1a" FOREIGN KEY ("purchase_order_id") REFERENCES "erp_purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD CONSTRAINT "FK_b068e64488f5e3d09d863faac1c" FOREIGN KEY ("supplier_id") REFERENCES "erp_business_partners"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP CONSTRAINT "FK_b068e64488f5e3d09d863faac1c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP CONSTRAINT "FK_de47da08f6e9e8b18601692fa1a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_73cbc322e818c4eb3472d5d002"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e7d5f00be786d23126d7d61786"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e782065896f7a7f531ac1eddc6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d4f109b9aeebbe94c219bf1904"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3f5cf5251bc14965d30b031ba7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4b5651bad5828ff8baf279728c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_be3501abc6b681be52900ee48e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41e4debe2f4b2b1b011a6c6a9f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4dd7cf4c0480e2b12751a4fa2a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f30f10221183a52e8d76e7780a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_order_materials" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD CONSTRAINT "erp_sales_orders_so_no_key" UNIQUE ("so_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issue_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_issues" ADD CONSTRAINT "erp_goods_issues_issue_no_key" UNIQUE ("issue_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipt_lines" ALTER COLUMN "qty_received" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_goods_receipts" ADD CONSTRAINT "erp_goods_receipts_receipt_no_key" UNIQUE ("receipt_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ALTER COLUMN "payment_status" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD CONSTRAINT "erp_purchase_orders_po_no_key" UNIQUE ("po_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_order_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_request_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD CONSTRAINT "erp_purchase_requests_request_no_key" UNIQUE ("request_no")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_bom_lines" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_boms" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "erp_boms" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD CONSTRAINT "erp_boms_bom_code_key" UNIQUE ("bom_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_balances" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_balances" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_transactions" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD CONSTRAINT "erp_inventory_items_sku_key" UNIQUE ("sku")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_business_partners" ADD CONSTRAINT "erp_business_partners_code_key" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_employees" ADD CONSTRAINT "erp_employees_employee_code_key" UNIQUE ("employee_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "core_users" ADD CONSTRAINT "core_users_email_key" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "note"`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_core_users_legacy_directus_user_id" ON "core_users" ("legacy_directus_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_core_users_employee_id" ON "core_users" ("employee_id") `,
    );
  }
}
