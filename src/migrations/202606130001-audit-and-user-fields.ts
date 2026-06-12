import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditAndUserFields2026061300011749772800001 implements MigrationInterface {
  name = 'AuditAndUserFields2026061300011749772800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend core_users with production fields
    await queryRunner.query(`
      ALTER TABLE core_users
        ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS created_by uuid NULL,
        ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NULL
    `);

    // Core audit log table — fire-and-forget writes, no FK constraints
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS erp_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id varchar(128) NULL,
        actor_user_id uuid NULL,
        actor_email varchar(255) NULL,
        actor_employee_id uuid NULL,
        action_type varchar(100) NOT NULL,
        module varchar(100) NOT NULL,
        entity_type varchar(100) NULL,
        entity_id varchar(255) NULL,
        route varchar(255) NULL,
        http_method varchar(20) NULL,
        status varchar(20) NOT NULL DEFAULT 'SUCCESS',
        message text NULL,
        ui_screen varchar(255) NULL,
        ui_action varchar(255) NULL,
        before_snapshot jsonb NULL,
        after_snapshot jsonb NULL,
        error_snapshot jsonb NULL,
        ip_address varchar(64) NULL,
        user_agent text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON erp_audit_logs(actor_user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON erp_audit_logs(entity_type, entity_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON erp_audit_logs(module)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON erp_audit_logs(created_at DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_created`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_module`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_entity`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_actor`);
    await queryRunner.query(`DROP TABLE IF EXISTS erp_audit_logs`);
    // Note: intentionally NOT dropping columns added to core_users (safe rollback)
  }
}
