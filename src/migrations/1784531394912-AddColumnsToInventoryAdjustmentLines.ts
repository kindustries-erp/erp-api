import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColumnsToInventoryAdjustmentLines1784531394912 implements MigrationInterface {
  name = 'AddColumnsToInventoryAdjustmentLines1784531394912';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "erp_inventory_adjustment_lines" 
            ADD "line_no" integer NOT NULL DEFAULT 0,
            ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "erp_inventory_adjustment_lines" 
            DROP COLUMN "updated_at",
            DROP COLUMN "created_at",
            DROP COLUMN "line_no"
        `);
  }
}
