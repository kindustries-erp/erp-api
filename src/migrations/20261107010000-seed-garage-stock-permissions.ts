import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền mặc định cho 3 resource kho garage mới (nhập, xuất, điều chỉnh).
 * Sao chép đúng role và action của `garage_goods_receipts` (nhóm quyền kho garage đang dùng).
 * Idempotent: không tạo lại quyền đã có.
 */
export class SeedGarageStockPermissions20261107010000 implements MigrationInterface {
  name = 'SeedGarageStockPermissions20261107010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "core_permissions" (
        "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
      )
      SELECT
        uuid_generate_v4(),
        p."role_id",
        t."resource",
        p."action",
        p."conditions",
        now(),
        now()
      FROM "core_permissions" p
      CROSS JOIN (VALUES
        ('garage_stock_receipts'),
        ('garage_stock_issues'),
        ('garage_stock_adjustments')
      ) AS t("resource")
      WHERE p."resource" = 'garage_goods_receipts'
      AND NOT EXISTS (
        SELECT 1
        FROM "core_permissions" target
        WHERE target."role_id" = p."role_id"
          AND target."resource" = t."resource"
          AND target."action" = p."action"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "core_permissions"
      WHERE "resource" IN ('garage_stock_receipts', 'garage_stock_issues', 'garage_stock_adjustments');
    `);
  }
}
