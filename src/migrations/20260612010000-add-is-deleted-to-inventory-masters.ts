import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToInventoryMasters20260612010000 implements MigrationInterface {
  name = 'AddIsDeletedToInventoryMasters20260612010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_uoms
        ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE erp_item_types
        ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE erp_uoms DROP COLUMN IF EXISTS is_deleted`,
    );
    await queryRunner.query(
      `ALTER TABLE erp_item_types DROP COLUMN IF EXISTS is_deleted`,
    );
  }
}
