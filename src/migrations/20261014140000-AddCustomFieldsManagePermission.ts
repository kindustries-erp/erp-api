import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quyền mới custom_fields:manage (quản trị category + định nghĩa thuộc tính của module-config).
 * Cấp cho các role đang có quyền accounting_configs (nhóm cấu hình hệ thống).
 */
export class AddCustomFieldsManagePermission20261014140000 implements MigrationInterface {
  name = 'AddCustomFieldsManagePermission20261014140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), r."role_id", 'custom_fields', 'manage', NULL, now(), now()
      FROM (SELECT DISTINCT "role_id" FROM "core_permissions" WHERE "resource" = 'accounting_configs') r
      WHERE NOT EXISTS (
        SELECT 1 FROM "core_permissions" t
        WHERE t."role_id" = r."role_id" AND t."resource" = 'custom_fields' AND t."action" = 'manage'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" = 'custom_fields' AND "action" = 'manage';`,
    );
  }
}
