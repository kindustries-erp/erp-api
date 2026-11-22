import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gỡ luồng PO garage cũ (erp_garage_purchase_orders / _lines) và quyền
 * resource garage_purchase_orders. Luồng thay thế: garage_procurement_orders.
 *
 * Chốt chặn: nếu bảng còn dòng dữ liệu thì RAISE EXCEPTION và không xóa gì.
 * Quyền garage_procurement_* đã được sao chép từ garage_purchase_orders ở
 * 20261105101500, nên xóa quyền cũ không làm mất quyền của luồng mới.
 *
 * down(): tạo lại bảng và FK như 20261104100000. KHÔNG khôi phục dữ liệu
 * hay quyền đã xóa (quyền có thể cấp lại bằng seed 20261104101000).
 */
export class DropGaragePurchaseOrders20261106100000 implements MigrationInterface {
  name = 'DropGaragePurchaseOrders20261106100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        header_count bigint := 0;
        line_count bigint := 0;
      BEGIN
        IF to_regclass('erp_garage_purchase_orders') IS NOT NULL THEN
          EXECUTE 'SELECT count(*) FROM "erp_garage_purchase_orders"' INTO header_count;
        END IF;
        IF to_regclass('erp_garage_purchase_order_lines') IS NOT NULL THEN
          EXECUTE 'SELECT count(*) FROM "erp_garage_purchase_order_lines"' INTO line_count;
        END IF;
        IF header_count > 0 OR line_count > 0 THEN
          RAISE EXCEPTION 'Còn dữ liệu garage PO cũ (header=%, lines=%); migrate trước khi gỡ', header_count, line_count;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" = 'garage_purchase_orders'`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_purchase_order_lines"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_garage_purchase_orders"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
  }
}
