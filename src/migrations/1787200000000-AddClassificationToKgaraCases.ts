import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClassificationToKgaraCases1787200000000 implements MigrationInterface {
  name = 'AddClassificationToKgaraCases1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "classification" character varying(100)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_classification" ON "kgara_cases" ("classification")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_classification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "classification"`,
    );
  }
}
