import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liên kết phiếu nhập garage với đơn mua garage (erp_garage_proc_orders).
 * - Phiếu nhập: garage_procurement_order_id (FK RESTRICT, nullable: phiếu nhập không-PO vẫn hợp lệ).
 * - Dòng phiếu nhập: procurement_order_line_id để biết dòng PO nào được nhận.
 * Có down().
 */
export class LinkGarageGoodsReceiptsToProcOrders20261105103500 implements MigrationInterface {
  name = 'LinkGarageGoodsReceiptsToProcOrders20261105103500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_garage_goods_receipts"
      ADD COLUMN IF NOT EXISTS "garage_procurement_order_id" uuid NULL
    `);
    // PostgreSQL không có ADD CONSTRAINT IF NOT EXISTS: bắt duplicate_object để chạy lại an toàn.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "erp_garage_goods_receipts"
        ADD CONSTRAINT "FK_erp_garage_goods_receipts_proc_order"
        FOREIGN KEY ("garage_procurement_order_id")
        REFERENCES "erp_garage_proc_orders"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_garage_goods_receipts_proc_order" ON "erp_garage_goods_receipts" ("garage_procurement_order_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "erp_garage_goods_receipt_lines"
      ADD COLUMN IF NOT EXISTS "procurement_order_line_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "erp_garage_goods_receipt_lines"
        ADD CONSTRAINT "FK_erp_garage_gr_lines_proc_order_line"
        FOREIGN KEY ("procurement_order_line_id")
        REFERENCES "erp_garage_proc_order_lines"("id") ON DELETE RESTRICT;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_garage_gr_lines_proc_order_line" ON "erp_garage_goods_receipt_lines" ("procurement_order_line_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_garage_gr_lines_proc_order_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_garage_goods_receipt_lines" DROP CONSTRAINT IF EXISTS "FK_erp_garage_gr_lines_proc_order_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_garage_goods_receipt_lines" DROP COLUMN IF EXISTS "procurement_order_line_id"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_garage_goods_receipts_proc_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_garage_goods_receipts" DROP CONSTRAINT IF EXISTS "FK_erp_garage_goods_receipts_proc_order"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_garage_goods_receipts" DROP COLUMN IF EXISTS "garage_procurement_order_id"`,
    );
  }
}
