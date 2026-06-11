import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToBusinessPartners20260612020000 implements MigrationInterface {
  name = 'AddIsDeletedToBusinessPartners20260612020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE erp_business_partners
        ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE erp_business_partners DROP COLUMN IF EXISTS is_deleted`,
    );
  }
}
