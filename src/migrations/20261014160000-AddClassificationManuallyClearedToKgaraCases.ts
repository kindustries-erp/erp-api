import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassificationManuallyClearedToKgaraCases20261014160000 implements MigrationInterface {
  name = 'AddClassificationManuallyClearedToKgaraCases20261014160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_cases"
      ADD COLUMN IF NOT EXISTS "classification_manually_cleared" BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "classification_manually_cleared";
    `);
  }
}
