import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyGaragePermissions20260830230000 implements MigrationInterface {
  name = 'MigrateLegacyGaragePermissions20260830230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Delete rows that would collide with an existing canonical permission, or
    // with an earlier legacy row when both old resources map to garage.
    await queryRunner.query(`
      DELETE FROM "core_permissions" p_legacy
      USING "core_permissions" p_existing
      WHERE p_legacy."resource" IN ('greenway_integration', 'kgara_integration')
        AND p_existing."role_id" = p_legacy."role_id"
        AND p_existing."action" = p_legacy."action"
        AND (
          p_existing."resource" = 'garage'
          OR (
            p_existing."resource" IN ('greenway_integration', 'kgara_integration')
            AND p_existing.ctid < p_legacy.ctid
          )
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
