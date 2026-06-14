import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToGoodsDocuments202606130830001749804200000 implements MigrationInterface {
  name = 'AddIsDeletedToGoodsDocuments202606130830001749804200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_goods_receipts
      ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE erp_goods_issues
      ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_goods_issues
      DROP COLUMN IF EXISTS is_deleted
    `);
    await queryRunner.query(`
      ALTER TABLE erp_goods_receipts
      DROP COLUMN IF EXISTS is_deleted
    `);
  }
}
