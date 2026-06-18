import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToPurchaseOrders1781790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_purchase_orders" DROP COLUMN "is_deleted"`,
    );
  }
}
