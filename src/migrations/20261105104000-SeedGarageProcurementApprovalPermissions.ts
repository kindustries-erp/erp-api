import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền approve/reject cho các role đang có quyền update trên
 * garage_procurement_requests / garage_procurement_orders.
 * Chỉ thêm bản ghi còn thiếu (NOT EXISTS). down() xóa đúng các bản ghi approve/reject
 * của hai resource này.
 */
export class SeedGarageProcurementApprovalPermissions20261105104000 implements MigrationInterface {
  name = 'SeedGarageProcurementApprovalPermissions20261105104000';

  private readonly resources = [
    'garage_procurement_requests',
    'garage_procurement_orders',
  ];
  private readonly actions = ['approve', 'reject'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const resource of this.resources) {
      for (const action of this.actions) {
        await queryRunner.query(
          `
          INSERT INTO "core_permissions" (
            "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
          )
          SELECT uuid_generate_v4(), p."role_id", CAST($1 AS varchar), CAST($2 AS varchar), p."conditions", now(), now()
          FROM "core_permissions" p
          WHERE p."resource" = CAST($1 AS varchar)
            AND p."action" = 'update'
            AND NOT EXISTS (
              SELECT 1 FROM "core_permissions" t
              WHERE t."role_id" = p."role_id"
                AND t."resource" = CAST($1 AS varchar)
                AND t."action" = CAST($2 AS varchar)
            )
          `,
          [resource, action],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" IN ('garage_procurement_requests','garage_procurement_orders') AND "action" IN ('approve','reject')`,
    );
  }
}
