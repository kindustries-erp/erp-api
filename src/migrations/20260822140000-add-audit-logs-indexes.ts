import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogsIndexes20260822140000 implements MigrationInterface {
  name = 'AddAuditLogsIndexes20260822140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_audit_logs_entity_created" 
      ON "erp_audit_logs" ("entity_type", "entity_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_audit_logs_created_at" 
      ON "erp_audit_logs" ("created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_audit_logs_actor_created" 
      ON "erp_audit_logs" ("actor_user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_erp_audit_logs_module_action" 
      ON "erp_audit_logs" ("module", "action_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_audit_logs_module_action"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_audit_logs_actor_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_audit_logs_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_erp_audit_logs_entity_created"`,
    );
  }
}
