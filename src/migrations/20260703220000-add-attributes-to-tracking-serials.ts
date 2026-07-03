import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttributesToTrackingSerials1751554617000 implements MigrationInterface {
  name = 'AddAttributesToTrackingSerials1751554617000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" ADD COLUMN IF NOT EXISTS "attributes" jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_inventory_tracking_serials" DROP COLUMN IF EXISTS "attributes"`,
    );
  }
}
