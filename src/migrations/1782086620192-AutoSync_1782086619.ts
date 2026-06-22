import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoSync17820866191782086620192 implements MigrationInterface {
  name = 'AutoSync17820866191782086620192';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."idx_erp_inventory_items_production_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN IF EXISTS "production_order_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" SET DEFAULT 'NONE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ALTER COLUMN "tracking_policy" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "production_order_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_erp_inventory_items_production_order_id" ON "erp_inventory_items" ("production_order_id") `,
    );
  }
}
