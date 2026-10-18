import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDashboardAndAttachmentsPermissions20261006163500 implements MigrationInterface {
  name = 'AddDashboardAndAttachmentsPermissions20261006163500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Grant 'dashboard' (read) to 'Admin' role or any role that has 'admin_users'
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), r."id", 'dashboard', 'read', NULL, now(), now()
      FROM "core_roles" r
      WHERE (r."name" ILIKE '%Admin%' OR EXISTS (
        SELECT 1 FROM "core_permissions" p
        WHERE p."role_id" = r."id" AND p."resource" = 'admin_users'
      ))
      AND NOT EXISTS (
        SELECT 1 FROM "core_permissions" p_target
        WHERE p_target."role_id" = r."id"
          AND p_target."resource" = 'dashboard'
          AND p_target."action" = 'read'
      );
    `);

    // 2. Grant 'attachments' ('*') to 'Admin' role or any role that has 'admin_users'
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), r."id", 'attachments', '*', NULL, now(), now()
      FROM "core_roles" r
      WHERE (r."name" ILIKE '%Admin%' OR EXISTS (
        SELECT 1 FROM "core_permissions" p
        WHERE p."role_id" = r."id" AND p."resource" = 'admin_users'
      ))
      AND NOT EXISTS (
        SELECT 1 FROM "core_permissions" p_target
        WHERE p_target."role_id" = r."id"
          AND p_target."resource" = 'attachments'
          AND p_target."action" = '*'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "core_permissions"
      WHERE "resource" IN ('dashboard', 'attachments');
    `);
  }
}
