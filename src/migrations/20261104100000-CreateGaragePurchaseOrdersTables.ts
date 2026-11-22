import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng Đơn mua hàng Garage (module v2 garage-purchase-orders).
 * Bảng mới, không đụng erp_purchase_orders. Cột khớp entity
 * GaragePurchaseOrder / GaragePurchaseOrderLine.
 */
export class CreateGaragePurchaseOrdersTables20261104100000 implements MigrationInterface {
  name = 'CreateGaragePurchaseOrdersTables20261104100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_garage_purchase_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "po_no" character varying(255) NOT NULL,
        "supplier_id" uuid NULL,
        "supplier_name" character varying(255) NULL,
        "order_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "expected_date" TIMESTAMP WITH TIME ZONE NULL,
        "branch_id" uuid NULL,
        "branch_name" character varying(255) NULL,
        "total_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "status" character varying(255) NOT NULL DEFAULT 'DRAFT',
        "payment_status" character varying(255) NOT NULL DEFAULT 'UNPAID',
        "remarks" text NULL,
        "supplier_invoice_no" character varying(128) NULL,
        "created_by" uuid NULL,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_garage_purchase_orders_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_erp_garage_purchase_orders_po_no"
      ON "erp_garage_purchase_orders" ("po_no")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_orders_supplier_id"
      ON "erp_garage_purchase_orders" ("supplier_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_orders_order_date"
      ON "erp_garage_purchase_orders" ("order_date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_orders_status"
      ON "erp_garage_purchase_orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_orders_branch_id"
      ON "erp_garage_purchase_orders" ("branch_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_orders_is_deleted"
      ON "erp_garage_purchase_orders" ("is_deleted")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "erp_garage_purchase_order_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "garage_purchase_order_id" uuid NOT NULL,
        "line_no" integer NOT NULL,
        "item_id" uuid NULL,
        "item_code" character varying(128) NULL,
        "item_name" character varying(255) NULL,
        "description" text NULL,
        "qty_ordered" numeric(18,3) NOT NULL,
        "qty_received" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_price" numeric(18,3) NULL,
        "amount" numeric(18,3) NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_erp_garage_purchase_order_lines_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_erp_garage_purchase_order_lines_po_id" FOREIGN KEY ("garage_purchase_order_id")
          REFERENCES "erp_garage_purchase_orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_order_lines_po_id"
      ON "erp_garage_purchase_order_lines" ("garage_purchase_order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_garage_purchase_order_lines_item_id"
      ON "erp_garage_purchase_order_lines" ("item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_purchase_order_lines"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_purchase_orders"`,
    );
  }
}
