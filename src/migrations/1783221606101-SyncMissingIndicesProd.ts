import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncMissingIndicesProd1783221606101 implements MigrationInterface {
  name = 'SyncMissingIndicesProd1783221606101';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inv_tracking_serial_status" ON "erp_inventory_tracking_serials" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inv_tracking_serial_so_line" ON "erp_inventory_tracking_serials" ("sales_order_line_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_inv_tracking_serial_so_line"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_inv_tracking_serial_status"`,
    );
  }
}
