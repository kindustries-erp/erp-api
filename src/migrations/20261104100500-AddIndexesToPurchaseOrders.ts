import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm index cho bảng Đơn mua hàng DÙNG CHUNG (erp_purchase_orders và
 * erp_purchase_order_lines). Chỉ thêm index, KHÔNG đổi cột hay dữ liệu.
 * Index đơn cột khớp với decorator @Index trong entity v2, để migration
 * generate sau này không báo lệch. Dùng IF NOT EXISTS để chạy lại an toàn.
 */
export class AddIndexesToPurchaseOrders20261104100500 implements MigrationInterface {
  name = 'AddIndexesToPurchaseOrders20261104100500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_orders_supplier_id"
      ON "erp_purchase_orders" ("supplier_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_orders_order_date"
      ON "erp_purchase_orders" ("order_date")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_orders_status"
      ON "erp_purchase_orders" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_orders_is_deleted"
      ON "erp_purchase_orders" ("is_deleted")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_order_lines_purchase_order_id"
      ON "erp_purchase_order_lines" ("purchase_order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_purchase_order_lines_item_id"
      ON "erp_purchase_order_lines" ("item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_order_lines_item_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_order_lines_purchase_order_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_orders_is_deleted"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_orders_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_orders_order_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_purchase_orders_supplier_id"`,
    );
  }
}
