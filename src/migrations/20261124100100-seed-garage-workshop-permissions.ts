import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp sẵn quyền resource mới `garage_workshop` (trang tiến độ xưởng) cho role đang có quyền `garage`:
 * sao chép `read`/`update` (giữ `conditions`). Role xưởng khác gán thêm trên Permission Matrix.
 * Idempotent (bỏ qua dòng đã có). down() xóa đúng resource `garage_workshop`.
 */
export class SeedGarageWorkshopPermissions20261124100100 implements MigrationInterface {
  name = 'SeedGarageWorkshopPermissions20261124100100';

  private readonly source = 'garage';
  private readonly target = 'garage_workshop';
  private readonly actions = ['read', 'update'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "rbac_permissions" (
        "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
      )
      SELECT uuid_generate_v4(), p."role_id", CAST($2 AS varchar), p."action", p."conditions", now(), now()
      FROM "rbac_permissions" p
      WHERE p."resource" = CAST($1 AS varchar)
        AND p."action" = ANY($3::varchar[])
        AND NOT EXISTS (
          SELECT 1 FROM "rbac_permissions" t
          WHERE t."role_id" = p."role_id"
            AND t."resource" = CAST($2 AS varchar)
            AND t."action" = p."action"
        )
      `,
      [this.source, this.target, this.actions],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "rbac_permissions" WHERE "resource" = $1`,
      [this.target],
    );
  }
}
