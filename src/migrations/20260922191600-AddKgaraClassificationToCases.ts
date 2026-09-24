import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKgaraClassificationToCases20260922191600 implements MigrationInterface {
  name = 'AddKgaraClassificationToCases20260922191600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "kgara_classification" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "kgara_classification_code" character varying(50)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_kgara_classification" ON "kgara_cases" ("kgara_classification")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_kgara_classification_code" ON "kgara_cases" ("kgara_classification_code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_kgara_classification_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_kgara_classification"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "kgara_classification_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "kgara_classification"`,
    );
  }
}
