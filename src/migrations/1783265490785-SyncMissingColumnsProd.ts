import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncMissingColumnsProd1783265490785 implements MigrationInterface {
  name = 'SyncMissingColumnsProd1783265490785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" ADD COLUMN IF NOT EXISTS "selected_serial_ids" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_sales_order_lines" DROP COLUMN "selected_serial_ids"`,
    );
  }
}
