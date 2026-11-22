import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm trạng thái thanh toán và số hóa đơn NCC vào đơn mua garage (erp_garage_proc_orders).
 * payment_status chỉ lưu, chưa có luồng ghi (DNTT làm sau). Có down().
 */
export class AddPaymentFieldsToGarageProcOrders20261105103000 implements MigrationInterface {
  name = 'AddPaymentFieldsToGarageProcOrders20261105103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_garage_proc_orders"
      ADD COLUMN IF NOT EXISTS "payment_status" varchar(50) NOT NULL DEFAULT 'UNPAID',
      ADD COLUMN IF NOT EXISTS "supplier_invoice_no" varchar(100) NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_garage_proc_orders_payment_status" ON "erp_garage_proc_orders" ("payment_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_garage_proc_orders_payment_status"`,
    );
    await queryRunner.query(`
      ALTER TABLE "erp_garage_proc_orders"
      DROP COLUMN IF EXISTS "supplier_invoice_no",
      DROP COLUMN IF EXISTS "payment_status"
    `);
  }
}
