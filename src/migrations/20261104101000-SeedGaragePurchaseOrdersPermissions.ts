import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền cho resource garage_purchase_orders bằng cách sao chép quyền
 * của resource garage (cùng role, cùng action). Không tự cấp cho vai trò mới:
 * chỉ mở rộng theo những vai trò đang có quyền garage. Có down().
 */
export class SeedGaragePurchaseOrdersPermissions20261104101000 implements MigrationInterface {
  name = 'SeedGaragePurchaseOrdersPermissions20261104101000';

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
        'garage_purchase_orders',
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
          AND target."resource" = 'garage_purchase_orders'
          AND target."action" = p."action"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "core_permissions"
      WHERE "resource" = 'garage_purchase_orders';
    `);
  }
}
