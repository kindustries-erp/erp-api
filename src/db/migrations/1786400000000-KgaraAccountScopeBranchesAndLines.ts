import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kgara: tách chi nhánh và dòng dịch vụ theo tài khoản nguồn.
 * - kgara_branches: unique (external_id, account_key) thay cho unique external_id,
 *   để CN2 có thể tồn tại ở cả MAIN và OJ.
 * - kgara_case_services: thêm account_key (backfill từ phiếu cha) và deleted_at (xóa mềm dòng).
 * Không thay đổi dữ liệu phiếu (kgara_cases).
 */
export class KgaraAccountScopeBranchesAndLines1786400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_0b4e59743700570a7ecb1ebf61"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_kgara_branches_external_account" ON "kgara_branches" ("external_id", "account_key")`,
    );

    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "account_key" varchar(50) NOT NULL DEFAULT 'MAIN'`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_case_services_account_key" ON "kgara_case_services" ("account_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_case_services_deleted_at" ON "kgara_case_services" ("deleted_at")`,
    );

    await queryRunner.query(
      `UPDATE "kgara_case_services" s SET "account_key" = c."account_key" FROM "kgara_cases" c WHERE c."hd_phieu_dich_vu_id" = s."hd_phieu_dich_vu_id" AND s."account_key" IS DISTINCT FROM c."account_key"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cảnh báo: khôi phục unique external_id chỉ thành công khi không còn external_id trùng giữa các tài khoản.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_case_services_deleted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_case_services_account_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" DROP COLUMN IF EXISTS "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_case_services" DROP COLUMN IF EXISTS "account_key"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_kgara_branches_external_account"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_0b4e59743700570a7ecb1ebf61" ON "kgara_branches" ("external_id")`,
    );
  }
}
