import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateBankAndCashPermissions20260831090000 implements MigrationInterface {
  name = 'MigrateBankAndCashPermissions20260831090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure any role with 'bank_accounts' has 'bank_statements'
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), p."role_id", 'bank_statements', p."action", p."conditions", now(), now()
      FROM "core_permissions" p
      WHERE p."resource" = 'bank_accounts'
        AND NOT EXISTS (
          SELECT 1 FROM "core_permissions" p_target
          WHERE p_target."role_id" = p."role_id"
            AND p_target."resource" = 'bank_statements'
            AND p_target."action" = p."action"
        )
    `);

    // 2. Ensure any role with 'bank_accounts', 'bank_statements', or 'cash_funds' has 'cash_statements'
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT DISTINCT ON (p."role_id", p."action") uuid_generate_v4(), p."role_id", 'cash_statements', p."action", p."conditions", now(), now()
      FROM "core_permissions" p
      WHERE p."resource" IN ('bank_accounts', 'bank_statements', 'cash_funds')
        AND NOT EXISTS (
          SELECT 1 FROM "core_permissions" p_target
          WHERE p_target."role_id" = p."role_id"
            AND p_target."resource" = 'cash_statements'
            AND p_target."action" = p."action"
        )
    `);

    // 3. Remove legacy 'bank_accounts' and 'cash_funds' resources from core_permissions
    await queryRunner.query(`
      DELETE FROM "core_permissions"
      WHERE "resource" IN ('bank_accounts', 'cash_funds')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Re-create bank_accounts from bank_statements if required
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), p."role_id", 'bank_accounts', p."action", p."conditions", now(), now()
      FROM "core_permissions" p
      WHERE p."resource" = 'bank_statements'
        AND NOT EXISTS (
          SELECT 1 FROM "core_permissions" p_target
          WHERE p_target."role_id" = p."role_id"
            AND p_target."resource" = 'bank_accounts'
            AND p_target."action" = p."action"
        )
    `);
  }
}
