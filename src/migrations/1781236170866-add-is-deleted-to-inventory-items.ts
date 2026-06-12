import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToInventoryItems1781236170866 implements MigrationInterface {
  name = 'AddIsDeletedToInventoryItems1781236170866';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "is_deleted"`,
    );
  }
}
