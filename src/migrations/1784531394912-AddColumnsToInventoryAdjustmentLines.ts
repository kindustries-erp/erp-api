import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColumnsToInventoryAdjustmentLines1784531394912 implements MigrationInterface {
  name = 'AddColumnsToInventoryAdjustmentLines1784531394912';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dùng IF NOT EXISTS để idempotent — các cột có thể đã tồn tại
    await queryRunner.query(`
      ALTER TABLE "erp_inventory_adjustment_lines"
        ADD COLUMN IF NOT EXISTS "line_no"     integer                  NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "created_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_inventory_adjustment_lines"
        DROP COLUMN IF EXISTS "updated_at",
        DROP COLUMN IF EXISTS "created_at",
        DROP COLUMN IF EXISTS "line_no"
    `);
  }
}
