import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoSync17835979511783597951804 implements MigrationInterface {
  name = 'AutoSync17835979511783597951804';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" ALTER COLUMN "serial_no" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" ALTER COLUMN "serial_no" DROP NOT NULL`,
    );
  }
}
