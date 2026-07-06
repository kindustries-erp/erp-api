import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropOldInventoryTables1783336178833 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_inventory_serials" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "erp_inventory_lots" CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Since we are just dropping unused legacy tables, the down migration is intentionally left empty.
  }
}
