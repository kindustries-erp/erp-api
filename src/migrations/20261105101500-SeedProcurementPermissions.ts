import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền cho 4 resource mới bằng cách sao chép CRUD từ resource cũ tương ứng
 * (cùng role). KHÔNG cấp approve/reject: quyền duyệt phải được gán có chủ đích
 * cho role phù hợp. Có down() xóa đúng các resource mới.
 */
export class SeedProcurementPermissions20261105101500 implements MigrationInterface {
  name = 'SeedProcurementPermissions20261105101500';

  private readonly mapping: Array<[string, string]> = [
    ['purchase_requests', 'procurement_requests'],
    ['purchase_orders', 'procurement_orders'],
    ['garage_purchase_orders', 'garage_procurement_requests'],
    ['garage_purchase_orders', 'garage_procurement_orders'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [source, target] of this.mapping) {
      await queryRunner.query(
        `
        INSERT INTO "core_permissions" (
          "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
        )
        SELECT uuid_generate_v4(), p."role_id", CAST($2 AS varchar), p."action", p."conditions", now(), now()
        FROM "core_permissions" p
        WHERE p."resource" = CAST($1 AS varchar)
          AND p."action" IN ('read', 'create', 'update', 'delete')
          AND NOT EXISTS (
            SELECT 1 FROM "core_permissions" t
            WHERE t."role_id" = p."role_id"
              AND t."resource" = CAST($2 AS varchar)
              AND t."action" = p."action"
          )
        `,
        [source, target],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" IN ('procurement_requests','procurement_orders','garage_procurement_requests','garage_procurement_orders')`,
    );
  }
}
