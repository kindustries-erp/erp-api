import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bổ sung cho `SeedGarageWorkshopPermissions20261124100100`: role có quyền `garage` dạng toàn quyền
 * (`*` hoặc `manage`) cũng được cấp `garage_workshop` `read` + `update` (giữ `conditions`).
 * Idempotent (bỏ qua dòng đã có). down() chỉ xóa dòng `garage_workshop` của các role đó mà migration này có thể đã thêm.
 */
export class SeedGarageWorkshopPermissionsFullAccess20261124120000 implements MigrationInterface {
  name = 'SeedGarageWorkshopPermissionsFullAccess20261124120000';

  private readonly source = 'garage';
  private readonly target = 'garage_workshop';
  private readonly fullActions = ['*', 'manage'];
  private readonly grants = ['read', 'update'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "rbac_permissions" (
        "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
      )
      SELECT DISTINCT ON (p."role_id", g.action)
        uuid_generate_v4(), p."role_id", CAST($2 AS varchar), g.action, p."conditions", now(), now()
      FROM "rbac_permissions" p
      CROSS JOIN unnest($4::varchar[]) AS g(action)
      WHERE p."resource" = CAST($1 AS varchar)
        AND p."action" = ANY($3::varchar[])
        AND NOT EXISTS (
          SELECT 1 FROM "rbac_permissions" t
          WHERE t."role_id" = p."role_id"
            AND t."resource" = CAST($2 AS varchar)
            AND t."action" = g.action
        )
      `,
      [this.source, this.target, this.fullActions, this.grants],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      DELETE FROM "rbac_permissions" t
      WHERE t."resource" = CAST($2 AS varchar)
        AND t."action" = ANY($4::varchar[])
        AND EXISTS (
          SELECT 1 FROM "rbac_permissions" p
          WHERE p."role_id" = t."role_id"
            AND p."resource" = CAST($1 AS varchar)
            AND p."action" = ANY($3::varchar[])
        )
        AND NOT EXISTS (
          SELECT 1 FROM "rbac_permissions" p
          WHERE p."role_id" = t."role_id"
            AND p."resource" = CAST($1 AS varchar)
            AND p."action" = t."action"
        )
      `,
      [this.source, this.target, this.fullActions, this.grants],
    );
  }
}
