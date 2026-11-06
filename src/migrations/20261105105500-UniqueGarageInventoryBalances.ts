import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Một mặt hàng chỉ có một dòng tồn trên mỗi chi nhánh. Chi nhánh null là một nhóm riêng.
 * Hai partial unique index vì UNIQUE thường coi NULL khác nhau, nên không chặn được trùng khi branch_id null.
 * up() dừng và liệt kê nếu dữ liệu hiện có đã trùng, không tự gộp.
 */
export class UniqueGarageInventoryBalances20261105105500 implements MigrationInterface {
  name = 'UniqueGarageInventoryBalances20261105105500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dupBranch: Array<{ branch_id: string; item_code: string }> =
      await queryRunner.query(
        `SELECT "branch_id", "item_code" FROM "erp_garage_inventory_balances"
         WHERE "branch_id" IS NOT NULL
         GROUP BY "branch_id", "item_code" HAVING COUNT(*) > 1`,
      );
    const dupNull: Array<{ item_code: string }> = await queryRunner.query(
      `SELECT "item_code" FROM "erp_garage_inventory_balances"
       WHERE "branch_id" IS NULL
       GROUP BY "item_code" HAVING COUNT(*) > 1`,
    );
    if (dupBranch.length > 0 || dupNull.length > 0) {
      throw new Error(
        `Dòng tồn garage bị trùng, cần gộp trước: ${JSON.stringify({ dupBranch, dupNull })}`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_garage_inv_bal_branch_item"
       ON "erp_garage_inventory_balances" ("branch_id", "item_code")
       WHERE "branch_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_garage_inv_bal_null_branch_item"
       ON "erp_garage_inventory_balances" ("item_code")
       WHERE "branch_id" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_garage_inv_bal_null_branch_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_garage_inv_bal_branch_item"`,
    );
  }
}
