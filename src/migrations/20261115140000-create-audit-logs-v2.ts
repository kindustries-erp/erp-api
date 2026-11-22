import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tạo bảng nhật ký kiểm toán v2 `audit_logs` (module `audit-logs`, chuẩn đặt tên v2, không prefix `erp_`)
 * và backfill toàn bộ dữ liệu từ `erp_audit_logs`.
 *
 * - Cột và kiểu giữ nguyên bảng cũ (kể cả `created_at` timestamp không múi giờ) để không lệch thời gian.
 * - `id` được giữ nguyên khi backfill; `ON CONFLICT (id) DO NOTHING` nên chạy lại để bù delta là an toàn.
 * - `erp_audit_logs` KHÔNG bị đụng tới (giữ làm bản lưu); `down()` chỉ xóa `audit_logs`.
 */
export class CreateAuditLogsV220261115140000 implements MigrationInterface {
  name = 'CreateAuditLogsV220261115140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" varchar(128),
        "actor_user_id" uuid,
        "actor_email" varchar(255),
        "actor_employee_id" uuid,
        "action_type" varchar(100) NOT NULL,
        "module" varchar(100) NOT NULL,
        "entity_type" varchar(100),
        "entity_id" varchar(255),
        "route" varchar(255),
        "http_method" varchar(20),
        "status" varchar(20) NOT NULL DEFAULT 'SUCCESS',
        "message" text,
        "ui_screen" varchar(255),
        "ui_action" varchar(255),
        "before_snapshot" jsonb,
        "after_snapshot" jsonb,
        "error_snapshot" jsonb,
        "ip_address" varchar(64),
        "user_agent" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entity_created" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at" ON "audit_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_created" ON "audit_logs" ("actor_user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_module_action" ON "audit_logs" ("module", "action_type")`,
    );

    await queryRunner.query(`
      INSERT INTO "audit_logs" (
        "id", "request_id", "actor_user_id", "actor_email", "actor_employee_id",
        "action_type", "module", "entity_type", "entity_id", "route", "http_method",
        "status", "message", "ui_screen", "ui_action",
        "before_snapshot", "after_snapshot", "error_snapshot",
        "ip_address", "user_agent", "created_at"
      )
      SELECT
        "id", "request_id", "actor_user_id", "actor_email", "actor_employee_id",
        "action_type", "module", "entity_type", "entity_id", "route", "http_method",
        "status", "message", "ui_screen", "ui_action",
        "before_snapshot", "after_snapshot", "error_snapshot",
        "ip_address", "user_agent", "created_at"
      FROM "erp_audit_logs"
      ON CONFLICT ("id") DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
