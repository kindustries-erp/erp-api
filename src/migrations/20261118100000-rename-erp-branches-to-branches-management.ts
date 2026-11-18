import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `erp_branches` -> `branches_management` (chuẩn v2): đổi tên bảng/PK/CHECK, thêm `is_deleted`,
 * `code` chỉ duy nhất trong bản ghi chưa xóa mềm, `created_at`/`updated_at` sang timestamptz
 * (giữ thời điểm: cột cũ lưu giờ UTC của server). Giữ nguyên id/dữ liệu; 6 FK đi theo bảng.
 * View `erp_branches` (đọc/ghi được) giữ tương thích cho bản code cũ trong lúc deploy, bỏ ở release sau.
 */
export class RenameErpBranchesToBranchesManagement20261118100000 implements MigrationInterface {
  name = 'RenameErpBranchesToBranchesManagement20261118100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists: Array<{ t: string | null }> = await queryRunner.query(
      `SELECT to_regclass('public.branches_management')::text AS t`,
    );
    if (exists[0]?.t) {
      throw new Error('Bảng branches_management đã tồn tại, dừng migration.');
    }
    await queryRunner.query(
      `ALTER TABLE "erp_branches" RENAME TO "branches_management"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" RENAME CONSTRAINT "erp_branches_pkey" TO "PK_branches_management_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" RENAME CONSTRAINT "CHK_erp_branches_extra_data_object" TO "CHK_branches_management_extra_data_object"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" ADD COLUMN "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branches_management_is_deleted" ON "branches_management" ("is_deleted")`,
    );
    await queryRunner.query(`DROP INDEX "IDX_759b04bed2a84a7feb09baad57"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_branches_management_code_active" ON "branches_management" ("code") WHERE "is_deleted" = false`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management"
         ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE USING "created_at" AT TIME ZONE 'UTC',
         ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE USING "updated_at" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `CREATE VIEW "erp_branches" AS
         SELECT "id", "extra_data", "created_at", "updated_at", "code", "name", "address", "is_active"
         FROM "branches_management"
         WHERE "is_deleted" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const soft: Array<{ n: string }> = await queryRunner.query(
      `SELECT count(*)::text AS n FROM "branches_management" WHERE "is_deleted" = true`,
    );
    if (Number(soft[0]?.n ?? 0) > 0) {
      throw new Error(
        `branches_management còn ${soft[0].n} dòng xóa mềm: khôi phục hoặc xóa hẳn trước khi hoàn tác`,
      );
    }
    await queryRunner.query(`DROP VIEW "erp_branches"`);
    await queryRunner.query(
      `ALTER TABLE "branches_management"
         ALTER COLUMN "created_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "created_at" AT TIME ZONE 'UTC',
         ALTER COLUMN "updated_at" TYPE TIMESTAMP WITHOUT TIME ZONE USING "updated_at" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(`DROP INDEX "UQ_branches_management_code_active"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_759b04bed2a84a7feb09baad57" ON "branches_management" ("code")`,
    );
    await queryRunner.query(`DROP INDEX "IDX_branches_management_is_deleted"`);
    await queryRunner.query(
      `ALTER TABLE "branches_management" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" RENAME CONSTRAINT "CHK_branches_management_extra_data_object" TO "CHK_erp_branches_extra_data_object"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" RENAME CONSTRAINT "PK_branches_management_id" TO "erp_branches_pkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branches_management" RENAME TO "erp_branches"`,
    );
  }
}
