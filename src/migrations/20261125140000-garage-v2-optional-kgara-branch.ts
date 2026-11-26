import { MigrationInterface, QueryRunner } from 'typeorm';

/** Bảng v2 garage có cột `branch_external_id` (UUID đơn vị KGara). */
const KGARA_BRANCH_TABLES = [
  'cases_garage',
  'case_progress_logs_garage',
  'debts_garage',
  'debt_allocations_garage',
  'cashflow_vouchers_garage',
] as const;

/**
 * Garage V2 bỏ khóa chi nhánh theo UUID KGara (GR/MAIN và GN/OJ dùng chung một UUID nên không phân biệt được).
 * - `branch_external_id` thành nullable: xe/chứng từ nhập ở ERP không cần UUID KGara; lọc chi nhánh dùng `branch_id`.
 * - Unique mã phiếu đổi từ `(branch_external_id, account_key, case_code)` sang `(account_key, case_code)`.
 * - Index board theo `branch_id` thay index theo `branch_external_id`.
 * - Backfill `branch_id` còn NULL: công nợ và thu chi theo vụ việc, phân bổ theo công nợ. Không ghi đè giá trị có sẵn.
 * down(): khôi phục index cũ; chỉ đặt lại NOT NULL khi không còn dòng NULL (fail kèm thông báo nếu có). Giữ giá trị backfill.
 */
export class GarageV2OptionalKgaraBranch20261125140000 implements MigrationInterface {
  name = 'GarageV2OptionalKgaraBranch20261125140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of KGARA_BRANCH_TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "branch_external_id" DROP NOT NULL`,
      );
    }

    const dupes: { account_key: string; case_code: string; n: number }[] =
      await queryRunner.query(`
        SELECT "account_key", "case_code", count(*)::int AS n FROM "cases_garage"
        WHERE "is_deleted" = false AND "external_deleted_at" IS NULL
        GROUP BY 1, 2 HAVING count(*) > 1 LIMIT 20
      `);
    if (dupes.length) {
      const list = dupes
        .map((d) => `${d.account_key}/${d.case_code} (${d.n})`)
        .join(', ');
      throw new Error(
        `Không thể đổi unique mã phiếu sang (account_key, case_code): còn mã trùng giữa các chi nhánh KGara: ${list}.`,
      );
    }
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cases_garage_case_code_active"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cases_garage_case_code_active"
        ON "cases_garage" ("account_key", "case_code")
        WHERE "is_deleted" = false AND "external_deleted_at" IS NULL
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cases_garage_workshop_tracked"`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_garage_branch_tracked"
        ON "cases_garage" ("branch_id", "workshop_tracked_at")
        WHERE "workshop_tracked_at" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "debts_garage" d SET "branch_id" = c."branch_id"
        FROM "cases_garage" c
       WHERE d."case_id" = c."id" AND d."branch_id" IS NULL AND c."branch_id" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "cashflow_vouchers_garage" v SET "branch_id" = c."branch_id"
        FROM "cases_garage" c
       WHERE v."case_id" = c."id" AND v."branch_id" IS NULL AND c."branch_id" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "debt_allocations_garage" a SET "branch_id" = d."branch_id"
        FROM "debts_garage" d
       WHERE a."debt_id" = d."id" AND a."branch_id" IS NULL AND d."branch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cases_garage_branch_tracked"`,
    );
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cases_garage_workshop_tracked"
        ON "cases_garage" ("branch_external_id", "workshop_tracked_at")
        WHERE "workshop_tracked_at" IS NOT NULL
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cases_garage_case_code_active"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cases_garage_case_code_active"
        ON "cases_garage" ("branch_external_id", "account_key", "case_code")
        WHERE "is_deleted" = false AND "external_deleted_at" IS NULL
    `);

    for (const table of KGARA_BRANCH_TABLES) {
      const rows = (await queryRunner.query(
        `SELECT count(*)::int AS n FROM "${table}" WHERE "branch_external_id" IS NULL`,
      )) as Array<{ n: number }>;
      const nulls = rows[0]?.n ?? 0;
      if (nulls > 0) {
        throw new Error(
          `Không thể đặt lại NOT NULL cho ${table}.branch_external_id: còn ${nulls} dòng NULL (xe/chứng từ nhập ở ERP).`,
        );
      }
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "branch_external_id" SET NOT NULL`,
      );
    }
  }
}
