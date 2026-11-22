import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cột theo dõi tiến độ từng xe cho `cases_garage` (nullable, không ảnh hưởng dữ liệu cũ).
 * `assignee_id` trỏ mềm tới `employees_management.id` (không FK, bảng nhân viên có thể rỗng).
 */
export class AddProgressColumnsCasesGarage20261122190300 implements MigrationInterface {
  name = 'AddProgressColumnsCasesGarage20261122190300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        ADD COLUMN IF NOT EXISTS "started_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "expected_completion_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "request_description" text,
        ADD COLUMN IF NOT EXISTS "diagnosis" text,
        ADD COLUMN IF NOT EXISTS "assignee_id" uuid,
        ADD COLUMN IF NOT EXISTS "progress_stage" varchar(30),
        ADD COLUMN IF NOT EXISTS "progress_percent" smallint,
        ADD COLUMN IF NOT EXISTS "progress_updated_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "progress_updated_by" uuid,
        ADD COLUMN IF NOT EXISTS "advisor_code" varchar(100),
        ADD COLUMN IF NOT EXISTS "advisor_name" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        ADD CONSTRAINT "CHK_cases_garage_progress_percent"
        CHECK ("progress_percent" IS NULL OR ("progress_percent" BETWEEN 0 AND 100))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_garage_assignee_id" ON "cases_garage" ("assignee_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_garage_status_expected_completion"
        ON "cases_garage" ("status", "expected_completion_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cases_garage_status_expected_completion"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cases_garage_assignee_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "cases_garage" DROP CONSTRAINT IF EXISTS "CHK_cases_garage_progress_percent"
    `);
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        DROP COLUMN IF EXISTS "advisor_name",
        DROP COLUMN IF EXISTS "advisor_code",
        DROP COLUMN IF EXISTS "progress_updated_by",
        DROP COLUMN IF EXISTS "progress_updated_at",
        DROP COLUMN IF EXISTS "progress_percent",
        DROP COLUMN IF EXISTS "progress_stage",
        DROP COLUMN IF EXISTS "assignee_id",
        DROP COLUMN IF EXISTS "diagnosis",
        DROP COLUMN IF EXISTS "request_description",
        DROP COLUMN IF EXISTS "expected_completion_at",
        DROP COLUMN IF EXISTS "started_at"
    `);
  }
}
