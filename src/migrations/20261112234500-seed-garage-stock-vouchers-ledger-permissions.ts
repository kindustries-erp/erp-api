import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cấp quyền xem cho 2 resource mới của kho Garage:
 * - `garage_stock_vouchers`: danh sách chứng từ kho gộp (nhập mua hàng, nhập khác, xuất, điều chỉnh).
 * - `garage_stock_ledger`: tồn kho (số dư theo mã hàng) và thẻ kho.
 * Chỉ sao chép action `read` từ các role đang có quyền trên `garage_goods_receipts`.
 * Thao tác trên phiếu (tạo, sửa, ghi sổ, hủy) vẫn theo quyền của từng loại phiếu, không cấp thêm ở đây.
 * Idempotent: không tạo lại quyền đã có. down() xóa đúng 2 resource.
 */
export class SeedGarageStockVouchersLedgerPermissions20261112234500 implements MigrationInterface {
  name = 'SeedGarageStockVouchersLedgerPermissions20261112234500';

  private readonly source = 'garage_goods_receipts';
  private readonly targets = ['garage_stock_vouchers', 'garage_stock_ledger'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const target of this.targets) {
      await queryRunner.query(
        `
        INSERT INTO "core_permissions" (
          "id", "role_id", "resource", "action", "conditions", "created_at", "updated_at"
        )
        SELECT uuid_generate_v4(), p."role_id", CAST($2 AS varchar), p."action", p."conditions", now(), now()
        FROM "core_permissions" p
        WHERE p."resource" = CAST($1 AS varchar)
          AND p."action" = 'read'
          AND NOT EXISTS (
            SELECT 1 FROM "core_permissions" t
            WHERE t."role_id" = p."role_id"
              AND t."resource" = CAST($2 AS varchar)
              AND t."action" = p."action"
          )
        `,
        [this.source, target],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "core_permissions" WHERE "resource" = ANY($1::varchar[])`,
      [this.targets],
    );
  }
}
