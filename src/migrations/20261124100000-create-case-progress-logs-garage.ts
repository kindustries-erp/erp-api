import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nhật ký tiến độ xưởng của vụ việc garage (`case_progress_logs_garage`), bảng riêng v2.
 * - `kind`: `STAGE` (một lần ở status nhỏ, `ended_at` null là đang mở) hoặc `NOTE`.
 * - `worker_id` trỏ mềm `employees_management.id` (không FK, giống `cases_garage.assignee_id`).
 * - Unique partial: mỗi vụ việc tối đa một công đoạn đang mở.
 * Bảng mới, không đụng dữ liệu cũ; down() drop bảng.
 */
export class CreateCaseProgressLogsGarage20261124100000 implements MigrationInterface {
  name = 'CreateCaseProgressLogsGarage20261124100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "case_progress_logs_garage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "extra_data" jsonb NOT NULL DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "is_deleted" boolean NOT NULL DEFAULT false,
        "case_id" uuid NOT NULL,
        "branch_external_id" varchar(100) NOT NULL,
        "kind" varchar(10) NOT NULL,
        "case_status" varchar(20) NOT NULL,
        "stage" varchar(30),
        "note" text,
        "worker_id" uuid,
        "worker_name" varchar(255),
        "started_at" timestamptz NOT NULL,
        "ended_at" timestamptz,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_case_progress_logs_garage" PRIMARY KEY ("id"),
        CONSTRAINT "FK_case_progress_logs_garage_case" FOREIGN KEY ("case_id")
          REFERENCES "cases_garage" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_case_progress_logs_garage_kind"
          CHECK ("kind" IN ('STAGE', 'NOTE')),
        CONSTRAINT "CHK_case_progress_logs_garage_stage"
          CHECK ("kind" <> 'STAGE' OR "stage" IS NOT NULL),
        CONSTRAINT "CHK_case_progress_logs_garage_period"
          CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_progress_logs_garage_case_started"
        ON "case_progress_logs_garage" ("case_id", "started_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_case_progress_logs_garage_is_deleted"
        ON "case_progress_logs_garage" ("is_deleted")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_case_progress_logs_garage_open_stage"
        ON "case_progress_logs_garage" ("case_id")
        WHERE "kind" = 'STAGE' AND "ended_at" IS NULL AND "is_deleted" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "case_progress_logs_garage"`);
  }
}
