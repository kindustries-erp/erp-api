import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền cho resource mới theo role đang có quyền trên `garage_procurement_requests`:
 * - `garage_items`: sao chép read/create/update/delete (danh mục mã hàng garage).
 * - `ai_hub_garage`: chỉ `create`, cho role đang được tạo đề nghị mua garage (dùng trợ lý AI).
 * `ai_hub_gateway` (usage log, health) không cấp sẵn: chỉ role có quyền `*` xem được,
 * role khác phải được gán có chủ đích. down() xóa đúng các resource mới.
 */
export class SeedAiHubGaragePermissions20261112150200 implements MigrationInterface {
  name = 'SeedAiHubGaragePermissions20261112150200';

  private readonly source = 'garage_procurement_requests';
  private readonly grants: Array<[string, string[]]> = [
    ['garage_items', ['read', 'create', 'update', 'delete']],
    ['ai_hub_garage', ['create']],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [target, actions] of this.grants) {
      await queryRunner.query(
        `
        INSERT INTO "core_permissions" (
          "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
        )
        SELECT uuid_generate_v4(), p."role_id", CAST($2 AS varchar), p."action", p."conditions", now(), now()
        FROM "core_permissions" p
        WHERE p."resource" = CAST($1 AS varchar)
          AND p."action" = ANY($3::varchar[])
          AND NOT EXISTS (
            SELECT 1 FROM "core_permissions" t
            WHERE t."role_id" = p."role_id"
              AND t."resource" = CAST($2 AS varchar)
              AND t."action" = p."action"
          )
        `,
        [this.source, target, actions],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" IN ('garage_items','ai_hub_garage','ai_hub_gateway')`,
    );
  }
}
