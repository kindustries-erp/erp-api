import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyGaragePermissions20260830230000 implements MigrationInterface {
  name = 'MigrateLegacyGaragePermissions20260830230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Delete duplicate legacy permissions if the role already has equivalent 'garage' permission for the same action
    await queryRunner.query(`
      DELETE FROM "core_permissions" p_legacy
      WHERE p_legacy."resource" IN ('greenway_integration', 'kgara_integration')
        AND EXISTS (
          SELECT 1 FROM "core_permissions" p_garage
          WHERE p_garage."role_id" = p_legacy."role_id"
            AND p_garage."resource" = 'garage'
            AND p_garage."action" = p_legacy."action"
        )
    `);

    // 2. Migrate remaining legacy permissions to 'garage'
    await queryRunner.query(`
      UPDATE "core_permissions"
      SET "resource" = 'garage'
      WHERE "resource" IN ('greenway_integration', 'kgara_integration')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op rollback as 'garage' is the consolidated canonical resource
  }
}
