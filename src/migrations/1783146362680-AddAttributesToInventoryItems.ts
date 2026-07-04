import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttributesToInventoryItems1783146362680 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" ADD "attributes" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_items" DROP COLUMN "attributes"`,
    );
  }
}
