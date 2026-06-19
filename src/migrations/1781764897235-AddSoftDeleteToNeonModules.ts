import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSoftDeleteToNeonModules1781764897235 implements MigrationInterface {
  name = 'AddSoftDeleteToNeonModules1781764897235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_boms" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD COLUMN IF NOT EXISTS "is_deleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_sales_orders" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_requests" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(`ALTER TABLE "erp_boms" DROP COLUMN "is_deleted"`);
  }
}
