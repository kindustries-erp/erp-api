import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kgara: lưu đối tượng thanh toán (DoiTuongThanhToanCode/Name) thành cột typed trên kgara_cases.
 * Backfill từ raw_data cho các phiếu đã sync chi tiết. Idempotent.
 */
export class AddPayerColumnsToKgaraCases20261119090000 implements MigrationInterface {
  name = 'AddPayerColumnsToKgaraCases20261119090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "doi_tuong_thanh_toan_code" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" ADD COLUMN IF NOT EXISTS "doi_tuong_thanh_toan_name" varchar(255) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_kgara_cases_doi_tuong_tt_code" ON "kgara_cases" ("doi_tuong_thanh_toan_code")`,
    );
    await queryRunner.query(
      `UPDATE "kgara_cases"
         SET "doi_tuong_thanh_toan_code" = NULLIF(BTRIM("raw_data"->>'DoiTuongThanhToanCode'), ''),
             "doi_tuong_thanh_toan_name" = NULLIF(BTRIM("raw_data"->>'DoiTuongThanhToanName'), '')
       WHERE "raw_data" IS NOT NULL
         AND (NULLIF(BTRIM("raw_data"->>'DoiTuongThanhToanCode'), '') IS NOT NULL
           OR NULLIF(BTRIM("raw_data"->>'DoiTuongThanhToanName'), '') IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_kgara_cases_doi_tuong_tt_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "doi_tuong_thanh_toan_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "kgara_cases" DROP COLUMN IF EXISTS "doi_tuong_thanh_toan_code"`,
    );
  }
}
