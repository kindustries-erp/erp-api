import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsActiveToBomConfig1787000000001 implements MigrationInterface {
  name = 'AddIsActiveToBomConfig1787000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "erp_bom_attribute_defs" DROP COLUMN IF EXISTS "is_active";
    `);
    await queryRunner.query(`
      ALTER TABLE "erp_bom_categories" DROP COLUMN IF EXISTS "is_active";
    `);
  }
}
