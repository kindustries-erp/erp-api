import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotesToProductionOrders20260704070000 implements MigrationInterface {
  name = 'AddNotesToProductionOrders20260704070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" ADD "notes" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "erp_production_orders" DROP COLUMN "notes"`,
    );
  }
}
