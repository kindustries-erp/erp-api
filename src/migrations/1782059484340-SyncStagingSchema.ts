import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncStagingSchema1782059484340 implements MigrationInterface {
  name = 'SyncStagingSchema1782059484340';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD COLUMN IF NOT EXISTS "tracking_policy" character varying(20) NOT NULL DEFAULT 'NONE'`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD COLUMN IF NOT EXISTS "tracking_category_key" character varying(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_category_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "tracking_policy"`,
    );
  }
}
