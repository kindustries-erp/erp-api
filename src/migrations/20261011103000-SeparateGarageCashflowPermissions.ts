import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateGarageCashflowPermissions20261011103000 implements MigrationInterface {
  name = 'SeparateGarageCashflowPermissions20261011103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sao chép toàn bộ quyền từ resource 'garage' sang 'garage_cashflow' cho mọi Role hiện tại
    await queryRunner.query(`
      INSERT INTO "core_permissions" ("id", "role_id", "resource", "action", "conditions", "created_at", "updated_at")
      SELECT uuid_generate_v4(), p."role_id", 'garage_cashflow', p."action", p."conditions", now(), now()
      FROM "core_permissions" p
      WHERE p."resource" = 'garage'
      AND NOT EXISTS (
        SELECT 1 FROM "core_permissions" p_target
        WHERE p_target."role_id" = p."role_id"
          AND p_target."resource" = 'garage_cashflow'
          AND p_target."action" = p."action"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "core_permissions"
      WHERE "resource" = 'garage_cashflow';
    `);
  }
}
