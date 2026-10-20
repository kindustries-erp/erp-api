import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateGarageDebtsPermissions20261013100000 implements MigrationInterface {
  name = 'SeparateGarageDebtsPermissions20261013100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "core_permissions" (
        "id",
        "role_id",
        "resource",
        "action",
        "conditions",
        "created_at",
        "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        p."role_id",
        'garage_debts',
        p."action",
        p."conditions",
        now(),
        now()
      FROM "core_permissions" p
      WHERE p."resource" = 'garage'
      AND NOT EXISTS (
        SELECT 1
        FROM "core_permissions" target
        WHERE target."role_id" = p."role_id"
          AND target."resource" = 'garage_debts'
          AND target."action" = p."action"
      );
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep independently granted garage_debts permissions intact on rollback.
  }
}
