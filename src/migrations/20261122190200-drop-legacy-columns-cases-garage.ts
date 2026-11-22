import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Xóa cột thừa của cases-garage:
 * - `cases_garage.legacy_case_id` (= id ở mọi dòng) cùng `UQ_cases_garage_legacy_case_id`.
 * - `case_lines_garage.legacy_service_id`: thay bằng unique (account_key, external_id).
 * - `cases_garage.external_delete_count`: không có code đọc (mất đếm lịch sử, down() đặt về 0).
 * up() dừng nếu dữ liệu không đủ điều kiện làm khóa nối.
 */
export class DropLegacyColumnsCasesGarage20261122190200 implements MigrationInterface {
  name = 'DropLegacyColumnsCasesGarage20261122190200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ bad }] = await queryRunner.query(`
      SELECT count(*)::int AS bad FROM "case_lines_garage" WHERE "external_id" IS NULL
    `);
    if (bad > 0) {
      throw new Error(
        `Không thể xóa legacy_service_id: ${bad} dòng thiếu external_id`,
      );
    }
    const [{ mismatch }] = await queryRunner.query(`
      SELECT count(*)::int AS mismatch FROM "cases_garage"
      WHERE "legacy_case_id" IS NOT NULL AND "legacy_case_id" <> "id"
    `);
    if (mismatch > 0) {
      throw new Error(`Không thể xóa legacy_case_id: ${mismatch} dòng khác id`);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_case_lines_garage_account_external_id"
        ON "case_lines_garage" ("account_key", "external_id")
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_case_lines_garage_legacy_service_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "case_lines_garage" DROP COLUMN "legacy_service_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_cases_garage_legacy_case_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cases_garage" DROP COLUMN "legacy_case_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cases_garage" DROP COLUMN "external_delete_count"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "cases_garage"
        ADD COLUMN "legacy_case_id" uuid,
        ADD COLUMN "external_delete_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(
      `UPDATE "cases_garage" SET "legacy_case_id" = "id"`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cases_garage_legacy_case_id"
        ON "cases_garage" ("legacy_case_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "case_lines_garage" ADD COLUMN "legacy_service_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "case_lines_garage" l
      SET "legacy_service_id" = k."id"
      FROM "kgara_case_services" k
      WHERE k."hd_phieu_dich_vu_chi_tiet_id" = l."external_id"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_case_lines_garage_legacy_service_id"
        ON "case_lines_garage" ("legacy_service_id")
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_case_lines_garage_account_external_id"`,
    );
  }
}
